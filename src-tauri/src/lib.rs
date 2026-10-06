//! Foreman Desktop's core: the app is a client of Foreman's CLI. Every device runs `fm … --json`, this machine
//! directly and others over ssh (one shared connection per host), and long-lived `--follow` commands stream
//! JSON lines to the webview over a Channel. No daemon and no new network service: ssh keys and Tailscale ACLs
//! already decide who may reach a device.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, State};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

/// A device: this machine (`host` empty or "local") or an ssh target such as `user@box` or a Tailscale name.
#[derive(Deserialize, Clone, Debug, Default)]
pub struct Device {
    #[serde(default)]
    pub host: Option<String>,
}

fn remote_host(dev: &Device) -> Option<&str> {
    dev.host.as_deref().map(str::trim).filter(|h| !h.is_empty() && *h != "local")
}

/// An ssh target is a host name, maybe with user@ and :port-free; never something ssh would read as an option.
pub fn valid_host(h: &str) -> Result<(), String> {
    let ok = !h.is_empty()
        && h.len() <= 253
        && !h.starts_with('-')
        && h.chars().all(|c| c.is_ascii_alphanumeric() || "._@-".contains(c));
    if ok { Ok(()) } else { Err(format!("not an ssh host: {h}")) }
}

/// One argument, quoted for the remote POSIX shell.
pub fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

const REMOTE_FM: &str = "\"${FOREMAN_HOME:-$HOME/.claude/foreman}/plugin/bin/fm\"";

fn quoted(args: &[String]) -> String {
    args.iter().map(|a| format!(" {}", sh_quote(a))).collect()
}

/// The command line the remote login shell runs: `sh -c` (so fish or csh logins work too) around Foreman's CLI where
/// install.sh puts it, every argument quoted.
pub fn remote_line(args: &[String]) -> String {
    format!("sh -c {}", sh_quote(&format!("exec {REMOTE_FM}{}", quoted(args))))
}

/// The same for a long-lived stream, which must end when the app lets go: ssh gives the remote command no hangup
/// signal, so it watches its stdin (the ssh channel; saved as fd 3, since a background job's stdin is /dev/null)
/// and stops fm when the channel closes.
pub fn remote_stream_line(args: &[String]) -> String {
    let inner = format!(
        "exec 3<&0; {REMOTE_FM}{} </dev/null & p=$!; (cat <&3 >/dev/null 2>&1; kill $p 2>/dev/null) >/dev/null 2>&1 & \
         exec 3<&-; wait $p",
        quoted(args)
    );
    format!("sh -c {}", sh_quote(&inner))
}

fn fm_path() -> std::path::PathBuf {
    let home = std::env::var_os("FOREMAN_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| dirs_home().join(".claude").join("foreman"));
    home.join("plugin").join("bin").join("fm")
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var_os("HOME").map(std::path::PathBuf::from).unwrap_or_else(|| "/".into())
}

fn ssh_opts() -> Vec<String> {
    let run = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| std::env::temp_dir().display().to_string());
    [
        "BatchMode=yes",
        // a device added in the app is trusted on first connect; a host key that later changes is still refused
        "StrictHostKeyChecking=accept-new",
        "ConnectTimeout=8",
        "ServerAliveInterval=20",
        "ControlMaster=auto",
        "ControlPersist=300",
    ]
    .iter()
    .flat_map(|o| ["-o".to_string(), o.to_string()])
    .chain(["-o".to_string(), format!("ControlPath={run}/fm-desktop-%C")])
    .collect()
}

/// The fm command for a device; `stream`: a long-lived one that ends when its stdin closes (remote only).
pub fn command(dev: &Device, args: &[String], stream: bool) -> Result<Command, String> {
    let remote = remote_host(dev).is_some();
    let mut c = match remote_host(dev) {
        None => {
            let mut c = Command::new(fm_path());
            c.args(args);
            c
        }
        Some(host) => {
            valid_host(host)?;
            let mut c = Command::new("ssh");
            let line = if stream { remote_stream_line(args) } else { remote_line(args) };
            c.args(ssh_opts()).arg(host).arg("--").arg(line);
            c
        }
    };
    c.stdin(if stream && remote { Stdio::piped() } else { Stdio::null() }).kill_on_drop(true);
    Ok(c)
}

/// Run `fm args…` on a device and return its stdout; its stderr (or exit code) when it fails.
#[tauri::command]
async fn fm(device: Device, args: Vec<String>) -> Result<String, String> {
    let mut c = command(&device, &args, false)?;
    c.stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = tokio::time::timeout(Duration::from_secs(120), c.output())
        .await
        .map_err(|_| "timed out after 120 s".to_string())?
        .map_err(|e| format!("can't run fm: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { format!("fm exited {}", out.status.code().unwrap_or(-1)) } else { err })
    }
}

#[derive(Default)]
struct Streams {
    next: AtomicU32,
    stop: Arc<Mutex<HashMap<u32, oneshot::Sender<()>>>>,
}

impl Streams {
    /// Stop every stream: the page that asked for them is gone (a reload starts its own).
    fn stop_all(&self) {
        for (_, tx) in self.stop.lock().unwrap().drain() {
            let _ = tx.send(());
        }
    }
}

/// Lines longer than this are dropped (a misbehaving device can't grow the app's memory without bound).
const MAX_LINE: usize = 8 * 1024 * 1024;

/// The next line without its newline; None at the end; an over-long line comes back empty (the page ignores it).
pub async fn next_line_capped<R: AsyncBufRead + Unpin>(r: &mut R, max: usize) -> std::io::Result<Option<String>> {
    let mut buf = Vec::new();
    if (&mut *r).take(max as u64).read_until(b'\n', &mut buf).await? == 0 {
        return Ok(None);
    }
    if buf.last() != Some(&b'\n') && buf.len() >= max {
        let mut rest = Vec::new();
        loop {
            rest.clear();
            let n = (&mut *r).take(64 * 1024).read_until(b'\n', &mut rest).await?;
            if n == 0 || rest.last() == Some(&b'\n') {
                return Ok(Some(String::new()));
            }
        }
    }
    while matches!(buf.last(), Some(b'\n' | b'\r')) {
        buf.pop();
    }
    Ok(Some(String::from_utf8_lossy(&buf).into_owned()))
}

/// The last line a stream sends: how it ended.
#[derive(Serialize)]
struct End {
    __end: i32,
    error: String,
}

/// Start a long-lived `fm … --follow` on a device; each stdout line goes to `on_line`, then one `{"__end": code}`.
#[tauri::command]
async fn fm_stream(
    device: Device,
    args: Vec<String>,
    on_line: Channel<String>,
    streams: State<'_, Streams>,
) -> Result<u32, String> {
    let mut c = command(&device, &args, true)?;
    c.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = c.spawn().map_err(|e| format!("can't run fm: {e}"))?;
    let stdin = child.stdin.take(); // held open while the stream lives: closing it ends the remote side
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let mut stderr = child.stderr.take().ok_or("no stderr")?;
    let id = streams.next.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, mut rx) = oneshot::channel();
    streams.stop.lock().unwrap().insert(id, tx);
    let registry = streams.stop.clone();
    tauri::async_runtime::spawn(async move {
        let err_task = tauri::async_runtime::spawn(async move {
            let mut buf = Vec::new();
            let _ = (&mut stderr).take(16 * 1024).read_to_end(&mut buf).await;
            String::from_utf8_lossy(&buf).trim().to_string()
        });
        let mut out = BufReader::new(stdout);
        loop {
            tokio::select! {
                _ = &mut rx => { let _ = child.kill().await; break; }
                line = next_line_capped(&mut out, MAX_LINE) => match line {
                    Ok(Some(l)) => if on_line.send(l).is_err() { let _ = child.kill().await; break; },
                    _ => break,
                },
            }
        }
        drop(stdin);
        let code = child.wait().await.ok().and_then(|s| s.code()).unwrap_or(-1);
        let error = err_task.await.unwrap_or_default();
        let _ = on_line.send(serde_json::to_string(&End { __end: code, error }).unwrap_or_default());
        registry.lock().unwrap().remove(&id);
    });
    Ok(id)
}

#[tauri::command]
fn fm_stream_stop(id: u32, streams: State<'_, Streams>) {
    if let Some(tx) = streams.stop.lock().unwrap().remove(&id) {
        let _ = tx.send(());
    }
}

#[derive(Serialize, Debug)]
pub struct Peer {
    name: String,
    dns: String,
    online: bool,
    os: String,
}

/// Tailscale peers, to suggest as devices (an empty list when Tailscale isn't running).
#[tauri::command]
async fn tailscale_peers() -> Result<Vec<Peer>, String> {
    let out = match Command::new("tailscale").args(["status", "--json"]).output().await {
        Ok(o) if o.status.success() => o.stdout,
        _ => return Ok(vec![]),
    };
    Ok(parse_peers(&out))
}

pub fn parse_peers(json: &[u8]) -> Vec<Peer> {
    let v: serde_json::Value = serde_json::from_slice(json).unwrap_or_default();
    let mut peers: Vec<Peer> = v["Peer"]
        .as_object()
        .map(|m| {
            m.values()
                .map(|p| Peer {
                    name: p["HostName"].as_str().unwrap_or_default().to_string(),
                    dns: p["DNSName"].as_str().unwrap_or_default().trim_end_matches('.').to_string(),
                    online: p["Online"].as_bool().unwrap_or(false),
                    os: p["OS"].as_str().unwrap_or_default().to_string(),
                })
                .filter(|p| !p.name.is_empty())
                .collect()
        })
        .unwrap_or_default();
    peers.sort_by(|a, b| b.online.cmp(&a.online).then(a.name.cmp(&b.name)));
    peers
}

/// This machine's name, for the local device's label.
#[tauri::command]
fn this_host() -> String {
    std::fs::read_to_string("/proc/sys/kernel/hostname")
        .or_else(|_| std::fs::read_to_string("/etc/hostname"))
        .map(|s| s.trim().to_string())
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("HOSTNAME").ok())
        .unwrap_or_else(|| "This device".into())
}

/// The page to open first: FOREMAN_DESKTOP_VIEW=sessions|agents|devices|project:<slug> (screenshots, scripts).
#[tauri::command]
fn initial_view() -> Option<String> {
    std::env::var("FOREMAN_DESKTOP_VIEW").ok().filter(|v| !v.is_empty())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .manage(Streams::default())
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                webview.app_handle().state::<Streams>().stop_all();
            }
        })
        .invoke_handler(tauri::generate_handler![fm, fm_stream, fm_stream_stop, tailscale_peers, this_host, initial_view])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn hosts_never_become_ssh_options() {
        for ok in ["box", "chase@box.tail1234.ts.net", "10.0.0.2", "my-pc"] {
            assert!(valid_host(ok).is_ok(), "{ok}");
        }
        for bad in ["-oProxyCommand=sh", "box;rm", "a b", "", "box$(x)", "a/b"] {
            assert!(valid_host(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn remote_arguments_survive_the_shell() {
        let line = remote_line(&args(&["capture", "it's $HOME `x` ; done"]));
        let dir = std::env::temp_dir().join(format!("fm-desktop-q-{}", std::process::id()));
        let fm = dir.join("plugin/bin/fm");
        std::fs::create_dir_all(fm.parent().unwrap()).unwrap();
        std::fs::write(&fm, "#!/bin/sh\nprintf '%s|' \"$@\"\n").unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&fm, std::fs::Permissions::from_mode(0o755)).unwrap();
        let out = std::process::Command::new("sh").args(["-c", &line]).env("FOREMAN_HOME", &dir).output().unwrap();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(String::from_utf8_lossy(&out.stdout), "capture|it's $HOME `x` ; done|");
    }

    #[tokio::test]
    async fn long_lines_are_dropped_not_kept() {
        let data = format!("{}\nok\n", "x".repeat(100));
        let mut r = BufReader::new(data.as_bytes());
        assert_eq!(next_line_capped(&mut r, 10).await.unwrap(), Some(String::new()));
        assert_eq!(next_line_capped(&mut r, 10).await.unwrap(), Some("ok".into()));
        assert_eq!(next_line_capped(&mut r, 10).await.unwrap(), None);
    }

    #[test]
    fn peers_online_first() {
        let j = br#"{"Peer":{"a":{"HostName":"zed","DNSName":"zed.ts.net.","Online":true,"OS":"linux"},
                    "b":{"HostName":"amy","DNSName":"amy.ts.net.","Online":false,"OS":"macOS"}}}"#;
        let p = parse_peers(j);
        assert_eq!((p[0].name.as_str(), p[0].dns.as_str(), p[1].name.as_str()), ("zed", "zed.ts.net", "amy"));
        assert!(parse_peers(b"not json").is_empty());
    }

    /// The real CLI on this machine, then the same through a stand-in ssh that runs the remote line locally.
    #[tokio::test]
    async fn fm_runs_locally_and_over_ssh() {
        if !fm_path().exists() {
            eprintln!("Foreman isn't installed here: skipped");
            return;
        }
        let local = fm(Device::default(), args(&["projects", "--json"])).await.unwrap();
        assert!(local.contains("\"projects\""));
        let dir = std::env::temp_dir().join(format!("fm-desktop-ssh-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let stub = dir.join("ssh");
        std::fs::write(&stub, "#!/bin/sh\nfor last; do :; done\nexec sh -c \"$last\"\n").unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&stub, std::fs::Permissions::from_mode(0o755)).unwrap();
        let path = format!("{}:{}", dir.display(), std::env::var("PATH").unwrap_or_default());
        let remote = Device { host: Some("box".into()) };
        let mut c = command(&remote, &args(&["projects", "--json"]), false).unwrap();
        let out = c.env("PATH", &path).stdout(Stdio::piped()).output().await.unwrap();
        assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
        assert!(String::from_utf8_lossy(&out.stdout).contains("\"projects\""));
        // a remote stream ends when the app closes the channel (its stdin), not only when ssh is killed
        let mut c = command(&remote, &args(&["projects", "--json", "--follow"]), true).unwrap();
        let mut child = c.env("PATH", &path).stdout(Stdio::piped()).spawn().unwrap();
        let mut out = BufReader::new(child.stdout.take().unwrap());
        assert!(next_line_capped(&mut out, MAX_LINE).await.unwrap().unwrap().contains("\"projects\""));
        drop(child.stdin.take());
        let status = tokio::time::timeout(Duration::from_secs(10), child.wait()).await.expect("stream kept running");
        assert!(status.is_ok());
        let _ = std::fs::remove_dir_all(dir);
        assert!(fm(Device { host: Some("-oProxyCommand=x".into()) }, vec![]).await.is_err());
    }
}

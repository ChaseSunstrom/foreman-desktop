// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK on Wayland with NVIDIA's explicit sync drops the connection (Gdk "Error 71") before the window
    // draws; Tauri's Linux graphics notes give this switch first. Harmless elsewhere; the user's own value wins.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WAYLAND_DISPLAY").is_some() && std::env::var_os("__NV_DISABLE_EXPLICIT_SYNC").is_none() {
        std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }
    foreman_desktop_lib::run()
}

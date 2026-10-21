pub fn current_ssid() -> Result<Option<String>, String> {
    platform::current_ssid()
}

fn field_value(output: &str, field: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        (key.trim() == field).then(|| value.trim().to_owned())
    })
}

#[cfg(target_os = "windows")]
mod platform {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Sans ce flag, chaque appel à netsh fait apparaître une console depuis une app GUI.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    pub fn current_ssid() -> Result<Option<String>, String> {
        let output = Command::new("netsh")
            .args(["wlan", "show", "interfaces"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|error| error.to_string())?;
        Ok(super::field_value(&String::from_utf8_lossy(&output.stdout), "SSID"))
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    const REDACTED_SSID: &str = "<redacted>";

    pub fn current_ssid() -> Result<Option<String>, String> {
        let device = wifi_device()?.unwrap_or_else(|| "en0".to_owned());
        let summary = run("ipconfig", &["getsummary", &device])?;
        match super::field_value(&summary, "SSID") {
            Some(ssid) if ssid == REDACTED_SSID => Err("SSID masqué par macOS (autorisation de localisation requise)".to_owned()),
            ssid => Ok(ssid),
        }
    }

    fn wifi_device() -> Result<Option<String>, String> {
        let ports = run("networksetup", &["-listallhardwareports"])?;
        let mut lines = ports.lines();
        while let Some(line) = lines.next() {
            if line.trim() == "Hardware Port: Wi-Fi" {
                return Ok(lines.next().and_then(|next| super::field_value(next, "Device")));
            }
        }
        Ok(None)
    }

    fn run(program: &str, args: &[&str]) -> Result<String, String> {
        let output = Command::new(program).args(args).output().map_err(|error| error.to_string())?;
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod platform {
    pub fn current_ssid() -> Result<Option<String>, String> {
        Err("Plateforme non supportée".to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::field_value;

    #[test]
    fn reads_ssid_from_netsh_output_without_confusing_it_with_bssid() {
        let output = "    Name                   : Wi-Fi\n    BSSID                  : aa:bb:cc:dd:ee:ff\n    SSID                   : Bureau\n";
        assert_eq!(field_value(output, "SSID"), Some("Bureau".to_owned()));
    }

    #[test]
    fn reads_ssid_from_ipconfig_summary() {
        let output = "<dictionary> {\n  InterfaceType : WiFi\n  SSID : Maison 5G\n}";
        assert_eq!(field_value(output, "SSID"), Some("Maison 5G".to_owned()));
    }

    #[test]
    fn returns_none_when_disconnected() {
        assert_eq!(field_value("    State : disconnected\n", "SSID"), None);
    }
}

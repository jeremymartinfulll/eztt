pub fn current_ssid() -> Result<Option<String>, String> {
    platform::current_ssid()
}

#[cfg(target_os = "windows")]
mod platform {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    // Sans ce flag, chaque appel à PowerShell fait apparaître une console depuis une app GUI.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    // Le nom du profil réseau reprend le SSID et, contrairement à netsh wlan (Windows 11 24H2+),
    // reste lisible quand la localisation est bloquée. NdisPhysicalMedium 9 = Native 802.11.
    const WIFI_PROFILE_SCRIPT: &str = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; \
        Get-NetAdapter -Physical | Where-Object NdisPhysicalMedium -eq 9 | \
        ForEach-Object { Get-NetConnectionProfile -InterfaceIndex $_.ifIndex -ErrorAction SilentlyContinue } | \
        Select-Object -ExpandProperty Name";

    pub fn current_ssid() -> Result<Option<String>, String> {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", WIFI_PROFILE_SCRIPT])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|error| error.to_string())?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
        }
        Ok(profile_name(&String::from_utf8_lossy(&output.stdout)))
    }

    fn profile_name(output: &str) -> Option<String> {
        output.lines().map(str::trim).find(|line| !line.is_empty()).map(str::to_owned)
    }

    #[cfg(test)]
    mod tests {
        use super::profile_name;

        #[test]
        fn reads_the_wifi_profile_name() {
            assert_eq!(profile_name("BureauWifi\r\n"), Some("BureauWifi".to_owned()));
        }

        #[test]
        fn returns_none_when_wifi_is_disconnected() {
            assert_eq!(profile_name("\r\n"), None);
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::process::Command;

    const REDACTED_SSID: &str = "<redacted>";

    pub fn current_ssid() -> Result<Option<String>, String> {
        let device = wifi_device()?.unwrap_or_else(|| "en0".to_owned());
        let summary = run("ipconfig", &["getsummary", &device])?;
        match field_value(&summary, "SSID") {
            Some(ssid) if ssid == REDACTED_SSID => Err("SSID masqué par macOS (autorisation de localisation requise)".to_owned()),
            ssid => Ok(ssid),
        }
    }

    fn wifi_device() -> Result<Option<String>, String> {
        let ports = run("networksetup", &["-listallhardwareports"])?;
        let mut lines = ports.lines();
        while let Some(line) = lines.next() {
            if line.trim() == "Hardware Port: Wi-Fi" {
                return Ok(lines.next().and_then(|next| field_value(next, "Device")));
            }
        }
        Ok(None)
    }

    fn run(program: &str, args: &[&str]) -> Result<String, String> {
        let output = Command::new(program).args(args).output().map_err(|error| error.to_string())?;
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    fn field_value(output: &str, field: &str) -> Option<String> {
        output.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            (key.trim() == field).then(|| value.trim().to_owned())
        })
    }

    #[cfg(test)]
    mod tests {
        use super::field_value;

        #[test]
        fn reads_ssid_from_ipconfig_summary_without_confusing_it_with_bssid() {
            let output = "<dictionary> {\n  BSSID : aa:bb:cc:dd:ee:ff\n  SSID : Maison 5G\n}";
            assert_eq!(field_value(output, "SSID"), Some("Maison 5G".to_owned()));
        }

        #[test]
        fn returns_none_when_disconnected() {
            assert_eq!(field_value("<dictionary> {\n  InterfaceType : WiFi\n}", "SSID"), None);
        }
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod platform {
    pub fn current_ssid() -> Result<Option<String>, String> {
        Err("Plateforme non supportée".to_owned())
    }
}

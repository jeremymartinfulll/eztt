export type NetworkStatus =
  | { readonly kind: "wifi"; readonly ssid: string }
  | { readonly kind: "unidentified"; readonly reason: string };

export type WorkLocation =
  | { readonly kind: "office" }
  | { readonly kind: "remote" }
  | { readonly kind: "unknown"; readonly reason: string };

// Helper nativo do mod "Mesa de Estudos" no Claude Desktop (macOS).
// Lista SOMENTE janelas visíveis via CoreGraphics, sem ativar nenhuma.
// Adaptado (somente leitura) de visual-check/windows.swift: o mesmo JSON,
// com ownerPID a mais para o host detectar reuso do MESMO id de janela.
// Compile explicitamente com: node scripts/build-helper.mjs
// (usa /usr/bin/xcrun swiftc; captura e doctor NUNCA compilam sozinhos).

import Foundation
import CoreGraphics

let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let result = windows.filter { ($0[kCGWindowLayer as String] as? Int) == 0 }.map { w -> [String: Any] in
  [
    "id": w[kCGWindowNumber as String] ?? 0,
    "app": w[kCGWindowOwnerName as String] ?? "",
    "title": w[kCGWindowName as String] ?? "",
    "bounds": w[kCGWindowBounds as String] ?? [:],
    "ownerPID": w[kCGWindowOwnerPID as String] ?? 0,
  ]
}
let data = try JSONSerialization.data(withJSONObject: ["permission": CGPreflightScreenCaptureAccess(), "windows": result], options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)

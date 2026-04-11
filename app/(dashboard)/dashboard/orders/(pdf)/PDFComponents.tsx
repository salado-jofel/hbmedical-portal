/** @jsxImportSource react */
/**
 * Shared PDF checkbox primitives for all react-pdf form templates.
 *
 * @react-pdf/renderer's built-in fonts (Helvetica etc.) don't include the
 * ☑/☐ Unicode glyphs, so we draw checkboxes with View borders instead.
 */
import { View, Text } from "@react-pdf/renderer";

/* ── Checked box — filled teal square with a white L-rotated checkmark ── */
export function Checked() {
  return (
    <View
      style={{
        width: 9,
        height: 9,
        backgroundColor: "#0d7a6b",
        borderWidth: 1,
        borderColor: "#0d7a6b",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 3,
        flexShrink: 0,
      }}
    >
      <View
        style={{
          width: 4,
          height: 2,
          borderBottomWidth: 1.5,
          borderLeftWidth: 1.5,
          borderColor: "#ffffff",
          transform: "rotate(-45deg)",
          marginTop: -1,
        }}
      />
    </View>
  );
}

/* ── Unchecked box — empty outlined square ── */
export function Unchecked() {
  return (
    <View
      style={{
        width: 9,
        height: 9,
        borderWidth: 1,
        borderColor: "#888888",
        backgroundColor: "#ffffff",
        marginRight: 3,
        flexShrink: 0,
      }}
    />
  );
}

/* ── CB — checkbox + label as a flex row ── */
export function CB({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8, marginBottom: 1 }}>
      {checked ? <Checked /> : <Unchecked />}
      <Text style={{ fontSize: 8, color: "#000000" }}>{label}</Text>
    </View>
  );
}

/* ── CBVal — radio-style: checked when current matches value (case-insensitive) ── */
export function CBVal({
  current,
  value,
  label,
}: {
  current: unknown;
  value: string;
  label: string;
}) {
  const isChecked =
    current != null &&
    String(current).toLowerCase() === value.toLowerCase();
  return <CB checked={isChecked} label={label} />;
}

/* ── CBArr — multi-select: checked when arr contains value (case-insensitive) ── */
export function CBArr({
  arr,
  value,
  label,
}: {
  arr: unknown;
  value: string;
  label: string;
}) {
  const isChecked =
    Array.isArray(arr) &&
    (arr as unknown[]).some(
      (v) => typeof v === "string" && v.toLowerCase() === value.toLowerCase()
    );
  return <CB checked={isChecked} label={label} />;
}

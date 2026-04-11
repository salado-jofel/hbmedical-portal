/** @jsxImportSource react */
import { View, Text, StyleSheet, Svg, Path } from "@react-pdf/renderer";

const NAVY   = "#0f2d4a";
const TEAL   = "#0d7a6b";
const ORANGE = "#e85d0a"; // solid color — url() gradients are unreliable in react-pdf
const GRAY   = "#555555";

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `1.5pt solid ${NAVY}`,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { flexDirection: "column" },
  brandName: { fontFamily: "Helvetica-Bold", fontSize: 14, color: NAVY, letterSpacing: 1 },
  brandSub: { fontFamily: "Helvetica-Bold", fontSize: 7, color: TEAL, letterSpacing: 0.5 },
  brandTagline: { fontSize: 6, color: TEAL, letterSpacing: 0.3, marginTop: 1 },
  addrBlock: { textAlign: "right", fontSize: 7, color: GRAY, lineHeight: 1.4 },
  titleArea: { marginTop: 5, marginBottom: 5 },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
    textAlign: "center",
    textDecoration: "underline",
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 7, color: GRAY, textAlign: "center", marginTop: 2 },
});

const LogoSVG = () => (
  <Svg viewBox="0 0 56 56" width={36} height={36}>
    {/* Orange arc — solid color, no gradient (url() refs unsupported in react-pdf) */}
    <Path
      d="M 14 44 A 22 22 0 1 1 46 36"
      stroke={ORANGE}
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
    />
    {/* Left tall mountain peak */}
    <Path
      d="M 10 44 L 24 13 L 38 44"
      stroke={NAVY}
      strokeWidth={2.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
    {/* Right shorter mountain peak */}
    <Path
      d="M 22 44 L 32 25 L 42 44"
      stroke={NAVY}
      strokeWidth={2.4}
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

export function PDFHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <View style={s.header}>
        {/* Left: Logo + Company */}
        <View style={s.brandRow}>
          <LogoSVG />
          <View style={s.brandText}>
            <Text style={s.brandName}>MERIDIAN</Text>
            <Text style={s.brandSub}>SURGICAL SUPPLIES</Text>
            <Text style={s.brandTagline}>EMPOWERING PATIENTS FROM THEIR HOME</Text>
          </View>
        </View>

        {/* Right: Contact Info */}
        <View style={s.addrBlock}>
          <Text>235 Singleton Ridge Road Suite 105</Text>
          <Text>Conway, SC 29526</Text>
          <Text>Support@meridiansurgicalsupplies.com</Text>
          <Text>www.meridiansurgicalsupplies.com</Text>
          <Text>(843) 733-9261</Text>
        </View>
      </View>

      {/* Center: Document Title */}
      <View style={s.titleArea}>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

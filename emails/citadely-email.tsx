import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Detail = { label: string; value: string };

export type CitadelyEmailProps = {
  preview: string;
  eyebrow: string;
  title: string;
  intro: string;
  statusLabel?: string;
  statusTone?: "primary" | "success" | "warning" | "danger";
  details?: Detail[];
  note?: string;
  actionLabel?: string;
  actionUrl?: string;
  businessLogoUrl?: string | null;
  brandAssetUrl: string;
  iconAssetUrl?: string;
};

const tones = {
  primary: { background: "#eaf2ff", color: "#0957d9", border: "#bed4fb" },
  success: { background: "#e7f7f0", color: "#087a55", border: "#afe1cd" },
  warning: { background: "#fff3df", color: "#a75900", border: "#f2cf92" },
  danger: { background: "#fff0f1", color: "#c32f3d", border: "#efb7bd" },
};

export function CitadelyEmail({
  preview,
  eyebrow,
  title,
  intro,
  statusLabel,
  statusTone = "primary",
  details = [],
  note,
  actionLabel,
  actionUrl,
  businessLogoUrl,
  brandAssetUrl,
  iconAssetUrl,
}: CitadelyEmailProps) {
  const tone = tones[statusTone];

  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandBar}>
            <Img alt="Citadely" height="36" src={brandAssetUrl} style={brandMark} width="36" />
            <Text style={brandName}>Citadely</Text>
          </Section>

          <Section style={content}>
            {businessLogoUrl ? (
              <Img alt="Logo del negocio" height="52" src={businessLogoUrl} style={businessLogo} width="52" />
            ) : null}
            {iconAssetUrl ? (
              <Img alt="" height="48" src={iconAssetUrl} style={messageIcon} width="48" />
            ) : null}
            <Text style={eyebrowStyle}>{eyebrow}</Text>
            <Heading as="h1" style={heading}>{title}</Heading>
            <Text style={introStyle}>{intro}</Text>

            {statusLabel ? (
              <Text style={{ ...status, backgroundColor: tone.background, color: tone.color, borderColor: tone.border }}>
                {statusLabel}
              </Text>
            ) : null}

            {details.length > 0 ? (
              <Section style={detailPanel}>
                {details.map((detail, index) => (
                  <Section key={`${detail.label}-${index}`} style={index === details.length - 1 ? detailRowLast : detailRow}>
                    <Text style={detailLabel}>{detail.label}</Text>
                    <Text style={detailValue}>{detail.value}</Text>
                  </Section>
                ))}
              </Section>
            ) : null}

            {note ? <Text style={noteStyle}>{note}</Text> : null}

            {actionLabel && actionUrl ? (
              <Button href={actionUrl} style={button}>{actionLabel}</Button>
            ) : null}

            <Hr style={rule} />
            <Text style={footer}>
              Este mensaje fue enviado por Citadely. Si se trata de un turno, podés responder este email para comunicarte con el negocio.
            </Text>
            <Text style={footer}>
              <Link href="https://citadely.com.ar" style={footerLink}>citadely.com.ar</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: "0",
  backgroundColor: "#f2f5fa",
  color: "#091a33",
  fontFamily: "Arial, Helvetica, sans-serif",
};
const container = { width: "100%", maxWidth: "600px", margin: "0 auto", padding: "28px 14px 40px" };
const brandBar = { backgroundColor: "#071f3d", padding: "18px 24px" };
const brandMark = { display: "inline-block", verticalAlign: "middle", borderRadius: "7px" };
const brandName = { display: "inline-block", margin: "0 0 0 11px", color: "#ffffff", fontSize: "19px", fontWeight: "700", verticalAlign: "middle" };
const content = { backgroundColor: "#ffffff", border: "1px solid #dce3ed", borderTop: "0", padding: "34px 30px 28px" };
const businessLogo = { objectFit: "cover" as const, border: "1px solid #dce3ed", borderRadius: "8px", marginBottom: "22px" };
const messageIcon = { display: "block", margin: "0 0 18px" };
const eyebrowStyle = { margin: "0 0 10px", color: "#0957d9", fontSize: "12px", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase" as const };
const heading = { margin: "0 0 16px", color: "#071f3d", fontSize: "30px", lineHeight: "1.15", letterSpacing: "-0.8px" };
const introStyle = { margin: "0 0 22px", color: "#526078", fontSize: "16px", lineHeight: "1.65" };
const status = { display: "inline-block", margin: "0 0 22px", border: "1px solid", borderRadius: "999px", padding: "7px 12px", fontSize: "12px", fontWeight: "700" };
const detailPanel = { border: "1px solid #dce3ed", backgroundColor: "#f7f9fc", margin: "0 0 22px" };
const detailRow = { borderBottom: "1px solid #dce3ed", padding: "13px 16px" };
const detailRowLast = { padding: "13px 16px" };
const detailLabel = { margin: "0 0 4px", color: "#657086", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" as const };
const detailValue = { margin: "0", color: "#091a33", fontSize: "15px", fontWeight: "600", lineHeight: "1.45" };
const noteStyle = { margin: "0 0 22px", border: "1px solid #dce3ed", backgroundColor: "#eaf2ff", padding: "13px 15px", color: "#0b2b52", fontSize: "14px", lineHeight: "1.55" };
const button = { backgroundColor: "#0957d9", borderRadius: "6px", color: "#ffffff", display: "inline-block", fontSize: "14px", fontWeight: "700", padding: "13px 18px", textDecoration: "none" };
const rule = { borderColor: "#dce3ed", margin: "30px 0 18px" };
const footer = { margin: "0 0 7px", color: "#657086", fontSize: "12px", lineHeight: "1.55" };
const footerLink = { color: "#0957d9", textDecoration: "none" };

import { getIconMap } from "./iconMap";
import { lookupCatalogIcon } from "./iconCatalog";

export function shortKind(kind) {
  const v = String(kind || "").trim();
  if (!v) return "";
  const parts = v.split(".");
  if (parts.length === 1) return v.toUpperCase();
  return parts[parts.length - 1].toUpperCase();
}

function containerKindToCatalogId(kind, label) {
  const k = String(kind || "").trim();
  const l = String(label || "").toLowerCase();
  if (k === "aws.vpc") return "Res_Amazon-VPC_Virtual-private-cloud-VPC_48";
  if (k === "aws.igw") return "Res_Amazon-VPC_Internet-Gateway_48";
  if (k === "aws.account") return "AWS-Account_32";
  if (k === "aws.region") return "Region_32";
  if (k === "aws.az") return "Region_32";
  if (k === "aws.subnet") return l.includes("public") ? "Public-subnet_32" : "Private-subnet_32";
  return null;
}

function providerFromKindPrefix(lowerKind) {
  const lower = String(lowerKind || "");
  if (lower.startsWith("azure_") || lower.startsWith("azure.")) return "azure";
  if (lower.startsWith("gcp_") || lower.startsWith("gcp.") || lower.startsWith("gcp-")) return "gcp";
  if (lower.startsWith("aws_") || lower.startsWith("aws.")) return "aws";
  return null;
}

export function resolveIcon(kind, label, provider = "aws") {
  const key = String(kind || "").trim();
  const providerKey = String(provider || "").toLowerCase();
  const inferredProvider = providerFromKindPrefix(key.toLowerCase());
  const lookupProvider = inferredProvider || providerKey || "aws";

  const fromMap = getIconMap()[key];
  if (fromMap?.primary) return { src: fromMap.primary, fallbackSrc: fromMap.fallback || null };

  if (providerKey === "aws") {
    const mapped = containerKindToCatalogId(key, label);
    if (mapped) {
      const e = lookupCatalogIcon("aws", mapped);
      if (e?.path) return { src: e.path, fallbackSrc: null };
    }
  }

  let fromCatalog = lookupCatalogIcon(lookupProvider, key);
  if (!fromCatalog?.path && lookupProvider === "azure" && !key.startsWith("Azure_")) {
    fromCatalog = lookupCatalogIcon(lookupProvider, `Azure_${key}`);
  }
  if (!fromCatalog?.path && lookupProvider === "gcp" && !key.startsWith("GCP_")) {
    fromCatalog = lookupCatalogIcon(lookupProvider, `GCP_${key}`);
  }
  if (fromCatalog?.path) return { src: fromCatalog.path, fallbackSrc: null };

  // Final fallback: provider logo (so non-matching kinds aren't blank).
  if (lookupProvider === "azure") return { src: "/logo-azure.png", fallbackSrc: null };
  if (lookupProvider === "gcp") return { src: "/logo-gcp.png", fallbackSrc: null };
  return { src: null, fallbackSrc: null };
}

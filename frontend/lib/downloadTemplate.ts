import { api, triggerDownload } from "./api";

const FILENAMES: Record<string, string> = {
  readiness: "template_readiness.xlsx",
  master:    "template_master_class_vg.xlsx",
  employees: "template_karyawan.xlsx",
  "ut-stock": "template_ut_stock.xlsx",
};

export async function downloadTemplate(type: keyof typeof FILENAMES) {
  const { blob, filename } = await api.download(`/templates/${type}`);
  triggerDownload(blob, filename ?? FILENAMES[type]);
}

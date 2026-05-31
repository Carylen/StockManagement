import { api } from "./api";

const FILENAMES: Record<string, string> = {
  readiness: "template_readiness.xlsx",
  master:    "template_master_class_vg.xlsx",
  employees: "template_karyawan.xlsx",
};

export async function downloadTemplate(type: keyof typeof FILENAMES) {
  const blob = await api.download(`/templates/${type}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILENAMES[type];
  a.click();
  URL.revokeObjectURL(url);
}

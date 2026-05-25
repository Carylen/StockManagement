"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import type { InquiryPulseItem } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

interface Props {
  data?: InquiryPulseItem[];
  loading: boolean;
}

export function InquiryPulse({ data, loading }: Props) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const dateFnsLocale = locale === "id" ? idLocale : enUS;

  const chartData = data?.map((item) => ({
    ...item,
    label: format(parseISO(item.date), "EEE", { locale: dateFnsLocale }),
  }));

  return (
    <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink">{t("classGInquiries")}</h3>
        <p className="text-xs text-ink-3 mt-0.5">{t("last7Days")}</p>
      </div>

      {loading ? (
        <div className="h-32 flex items-end gap-1">
          {[...Array(7)].map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      ) : chartData && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barSize={24} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#A39A8A", fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#A39A8A" }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "#FFF1D0" }}
              contentStyle={{
                background: "white",
                border: "1px solid rgba(27,24,20,0.1)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
              }}
              formatter={(val: number) => [val, "Inquiry"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.count > 0 ? "#F5A623" : "#F5EFE1"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-32 flex items-center justify-center">
          <p className="text-sm text-ink-3">{t("noInquiryData")}</p>
        </div>
      )}
    </div>
  );
}

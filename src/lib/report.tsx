import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatMoney } from "./money";

export type ReportData = {
  title: string;
  subtitle: string;
  currency: string;
  income: number;
  spent: number;
  categories: { name: string; total: number; count: number }[];
  budgets: { name: string; spent: number; limit: number }[];
  transactions: { date: string; note: string; category: string; account: string; type: string; amount: number }[];
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#111318", fontFamily: "Helvetica" },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF", backgroundColor: "#111318", padding: "5 8", borderRadius: 6, alignSelf: "flex-start" },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 14 },
  sub: { fontSize: 11, color: "#5F6672", marginTop: 4 },
  cards: { flexDirection: "row", marginTop: 18 },
  card: { flex: 1, backgroundColor: "#F4F5F7", borderRadius: 10, padding: 12, marginRight: 8 },
  cardLabel: { fontSize: 9, color: "#5F6672" },
  cardValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 22, marginBottom: 8 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#E6E8EB", alignItems: "center" },
  barTrack: { height: 6, backgroundColor: "#EEF0F2", borderRadius: 3, flex: 1, marginHorizontal: 8 },
  bar: { height: 6, backgroundColor: "#FF5A36", borderRadius: 3 },
  th: { fontFamily: "Helvetica-Bold", color: "#5F6672", fontSize: 9 },
  foot: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#9AA0AA", flexDirection: "row", justifyContent: "space-between" },
});

function Report({ d }: { d: ReportData }) {
  const max = Math.max(1, ...d.categories.map((c) => c.total));
  const m = (n: number) => formatMoney(n, d.currency);
  return (
    <Document title={d.title} author="Pocket">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Pocket</Text>
        <Text style={s.h1}>{d.title}</Text>
        <Text style={s.sub}>{d.subtitle}</Text>
        <View style={s.cards}>
          <View style={s.card}><Text style={s.cardLabel}>Spent</Text><Text style={s.cardValue}>{m(d.spent)}</Text></View>
          <View style={s.card}><Text style={s.cardLabel}>Income</Text><Text style={s.cardValue}>{m(d.income)}</Text></View>
          <View style={[s.card, { marginRight: 0 }]}><Text style={s.cardLabel}>Saved</Text><Text style={s.cardValue}>{m(d.income - d.spent)}</Text></View>
        </View>

        <Text style={s.h2}>Spending by category</Text>
        {d.categories.length === 0 && <Text style={{ color: "#5F6672" }}>No spending in this period.</Text>}
        {d.categories.map((c) => (
          <View key={c.name} style={s.row} wrap={false}>
            <Text style={{ width: 110 }}>{c.name}</Text>
            <View style={s.barTrack}><View style={[s.bar, { width: `${(c.total / max) * 100}%` }]} /></View>
            <Text style={{ width: 40, color: "#5F6672", textAlign: "right" }}>{c.count}</Text>
            <Text style={{ width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{m(c.total)}</Text>
          </View>
        ))}

        {d.budgets.length > 0 && <Text style={s.h2}>Budgets</Text>}
        {d.budgets.map((b) => (
          <View key={b.name} style={s.row} wrap={false}>
            <Text style={{ width: 110 }}>{b.name}</Text>
            <View style={s.barTrack}><View style={[s.bar, { width: `${Math.min(100, (b.spent / Math.max(1, b.limit)) * 100)}%`, backgroundColor: b.spent > b.limit ? "#D6402A" : "#111318" }]} /></View>
            <Text style={{ width: 130, textAlign: "right" }}>{m(b.spent)} of {m(b.limit)}</Text>
          </View>
        ))}

        <Text style={s.h2} break={d.transactions.length > 12}>Transactions</Text>
        <View style={s.row} fixed>
          <Text style={[s.th, { width: 62 }]}>Date</Text>
          <Text style={[s.th, { flex: 1 }]}>Note</Text>
          <Text style={[s.th, { width: 90 }]}>Category</Text>
          <Text style={[s.th, { width: 70 }]}>Account</Text>
          <Text style={[s.th, { width: 80, textAlign: "right" }]}>Amount</Text>
        </View>
        {d.transactions.map((t, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={{ width: 62, color: "#5F6672" }}>{t.date}</Text>
            <Text style={{ flex: 1 }}>{t.note || "—"}</Text>
            <Text style={{ width: 90 }}>{t.category}</Text>
            <Text style={{ width: 70 }}>{t.account}</Text>
            <Text style={{ width: 80, textAlign: "right", color: t.type === "income" ? "#13824F" : "#111318" }}>
              {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{m(t.amount)}
            </Text>
          </View>
        ))}
        <View style={s.foot} fixed>
          <Text>Made with Pocket</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReport(d: ReportData) {
  return renderToBuffer(<Report d={d} />);
}

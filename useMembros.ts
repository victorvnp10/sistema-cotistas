export function formatarMoeda(valor: number, moeda = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(
    valor || 0
  );
}

export function mesReferenciaAtual(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${m < 10 ? "0" + m : m}-01`;
}

// Selo oficial do Asaas — identifica o Asaas como prestador dos serviços financeiros
// de pagamento, conforme exigido pelo Playbook de BaaS (Resolução Conjunta nº 16/2025 do BACEN).
// Links homologados fornecidos pelo suporte Asaas para esta operação: não trocar por outra URL.
const SELO_URL =
  "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=63f4f09e-c968-4df9-a84f-a631f47634c0";

export function SeloAsaas({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://asaas.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block ${className}`}
      title="Serviços financeiros processados pelo Asaas"
    >
      <img src={SELO_URL} alt="Selo Serviços Financeiros Asaas" width={140} height={42} style={{ display: "inline-block" }} />
    </a>
  );
}

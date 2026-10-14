import { LEGAL } from '@/config/legal';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export type LegalDoc = 'termos' | 'privacidade';

const TERMS: LegalSection[] = [
  {
    title: '1. O que é o CaixaPro',
    paragraphs: [
      'O CaixaPro é uma ferramenta de organização financeira para pessoas e pequenos negócios: você registra receitas e despesas e acompanha seus números.',
      'O CaixaPro não é software contábil, não faz apuração de impostos e não presta consultoria financeira, contábil, jurídica ou de investimentos. O "saldo registrado" é calculado apenas com o que você registra; ele não está conectado à sua conta bancária e pode ser diferente do saldo real.',
    ],
  },
  {
    title: '2. Quem pode usar',
    paragraphs: [
      'O serviço é destinado a maiores de 18 anos com capacidade civil. Você se compromete a informar dados verdadeiros e a manter sua senha em segredo; as ações feitas na sua conta são de sua responsabilidade.',
    ],
  },
  {
    title: '3. Seus dados',
    paragraphs: [
      'Os dados que você registra são seus. Você nos autoriza apenas a armazená-los e processá-los para prestar o serviço, conforme a Política de Privacidade.',
      'Você pode baixar uma cópia dos seus dados ou excluir a conta a qualquer momento, na página "Minha conta".',
    ],
  },
  {
    title: '4. Uso adequado',
    paragraphs: [
      'Não é permitido usar o CaixaPro para atividades ilegais, tentar acessar dados de outras pessoas, burlar os limites dos planos, sobrecarregar ou atacar o serviço, ou copiar o sistema por engenharia reversa.',
    ],
  },
  {
    title: '5. Planos e preços',
    paragraphs: [
      'O plano Free é gratuito e tem limites de uso (por exemplo, quantidade de lançamentos por mês e período de histórico). O plano Pro custa, hoje, R$ 19,90 por mês. O plano Enterprise está em desenvolvimento e ainda não pode ser contratado.',
      'Podemos alterar preços e limites mediante aviso prévio. Novos preços não valem para o período que você já pagou.',
    ],
  },
  {
    title: '6. Pagamento',
    paragraphs: [
      'Os pagamentos são processados pelo Mercado Pago. O CaixaPro não recebe nem guarda os dados do seu cartão.',
      'No cartão, o Pro é uma assinatura mensal com renovação automática até você cancelar. No Pix, o pagamento é avulso e libera 30 dias de Pro, sem renovação automática: para continuar, é preciso pagar novamente.',
      'Se uma cobrança não for concluída, o acesso ao Pro termina ao fim do período já pago e a conta volta ao plano Free. Seus dados continuam guardados; só valem de novo os limites do Free.',
    ],
  },
  {
    title: '7. Cancelamento e reembolso',
    paragraphs: [
      'Você pode cancelar a assinatura a qualquer momento em "Plano e cobrança". O acesso ao Pro continua até o fim do período já pago.',
      'Para contratações feitas pela internet, você tem 7 dias, contados da contratação, para desistir e pedir o reembolso integral (art. 49 do Código de Defesa do Consumidor). Para isso, escreva para {{email}}.',
    ],
  },
  {
    title: '8. Disponibilidade e mudanças no serviço',
    paragraphs: [
      'Trabalhamos para manter o serviço disponível, mas não garantimos funcionamento ininterrupto. Podemos fazer manutenções e alterar ou descontinuar recursos, avisando com antecedência razoável quando houver impacto relevante.',
    ],
  },
  {
    title: '9. Limitação de responsabilidade',
    paragraphs: [
      'As informações exibidas dependem do que você registra. Você é responsável pelas decisões financeiras que tomar. Dentro do que a lei permite, e sem afastar os direitos do consumidor, a responsabilidade do CaixaPro fica limitada ao valor que você pagou pelo serviço nos 12 meses anteriores ao fato.',
    ],
  },
  {
    title: '10. Encerramento',
    paragraphs: [
      'Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar contas em caso de violação destes Termos ou de fraude, avisando sempre que possível.',
    ],
  },
  {
    title: '11. Alterações destes Termos',
    paragraphs: [
      'Podemos atualizar estes Termos. Avisaremos pelo aplicativo ou por e-mail. Se continuar usando o serviço depois do aviso, você concorda com a nova versão; se não concordar, pode excluir a conta.',
    ],
  },
  {
    title: '12. Lei aplicável e contato',
    paragraphs: [
      'Aplicam-se as leis do Brasil, e fica eleito o foro do domicílio do consumidor. Serviço oferecido por {{responsavel}}. Contato: {{email}}.',
    ],
  },
];

const PRIVACY: LegalSection[] = [
  {
    title: '1. Quem somos',
    paragraphs: ['O responsável pelo tratamento dos seus dados pessoais (controlador, nos termos da Lei Geral de Proteção de Dados, a LGPD) é {{responsavel}}. Contato: {{email}}.'],
  },
  {
    title: '2. Quais dados tratamos',
    paragraphs: [
      'Dados da conta: e-mail e senha (a senha é guardada de forma protegida pelo provedor de autenticação; nós não a vemos).',
      'Dados financeiros que você mesmo registra: lançamentos (valores, datas, descrições, categorias, formas de pagamento), orçamentos, metas, recorrências, contas a pagar e a receber, saldo inicial e o nome do seu espaço de trabalho.',
      'Dados de cobrança: quando você contrata o Pro, o Mercado Pago processa o pagamento. Nós recebemos apenas o status, o valor, as datas e identificadores da cobrança. Não recebemos o número do seu cartão.',
      'Dados técnicos: registros de funcionamento do serviço (por exemplo, erros e chamadas), usados para segurança e correção de falhas.',
    ],
  },
  {
    title: '3. Para que usamos',
    paragraphs: [
      'Para criar e manter sua conta, prestar o serviço (calcular saldos, resumos e relatórios), processar e confirmar pagamentos, garantir a segurança, prevenir fraudes, dar suporte e cumprir obrigações legais.',
      'Não vendemos seus dados e não usamos suas informações financeiras para publicidade.',
    ],
  },
  {
    title: '4. Bases legais',
    paragraphs: [
      'Tratamos seus dados para executar o contrato do serviço que você pediu, para cumprir obrigações legais, para proteger a segurança do serviço (legítimo interesse) e, quando for o caso, com o seu consentimento.',
    ],
  },
  {
    title: '5. Com quem compartilhamos',
    paragraphs: [
      'Usamos fornecedores que tratam dados em nosso nome: Supabase (banco de dados, autenticação e funções do servidor), Netlify (hospedagem do site) e Mercado Pago (pagamentos). Os servidores desses fornecedores podem estar fora do Brasil, e adotamos fornecedores que oferecem salvaguardas compatíveis com a LGPD.',
      'O site carrega fontes do Google Fonts, o que pode expor o seu endereço IP ao Google. Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir.',
    ],
  },
  {
    title: '6. Armazenamento no seu navegador',
    paragraphs: [
      'Guardamos no navegador apenas o necessário para manter você conectado, para lembrar que você dispensou o aviso de instalação do aplicativo e para o funcionamento offline básico do aplicativo instalável (sem dados financeiros). Não usamos cookies de publicidade ou de rastreamento.',
    ],
  },
  {
    title: '7. Por quanto tempo guardamos',
    paragraphs: [
      'Guardamos seus dados enquanto a sua conta existir. Ao excluir a conta, os dados são apagados do banco de dados do serviço. Cópias de segurança do provedor podem manter os dados por um período limitado antes de serem descartadas. Registros de pagamento podem ser mantidos pelo Mercado Pago e por nós pelo prazo exigido em lei.',
    ],
  },
  {
    title: '8. Seus direitos',
    paragraphs: [
      'Pela LGPD, você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre com quem compartilhamos e a revogação de consentimento.',
      'Você pode baixar uma cópia dos seus dados e excluir a sua conta por conta própria na página "Minha conta". Para outros pedidos, escreva para {{email}}.',
    ],
  },
  {
    title: '9. Segurança',
    paragraphs: [
      'Usamos conexão criptografada (HTTPS), controle de acesso por conta no banco de dados, de modo que cada pessoa acessa apenas os próprios dados, e guardamos credenciais sensíveis apenas no servidor. Nenhum sistema é totalmente imune a falhas; se houver um incidente que possa afetar você, avisaremos conforme a lei.',
    ],
  },
  {
    title: '10. Crianças e adolescentes',
    paragraphs: ['O CaixaPro é destinado a maiores de 18 anos e não coletamos dados de menores de forma intencional.'],
  },
  {
    title: '11. Alterações desta política',
    paragraphs: ['Podemos atualizar esta política. Avisaremos pelo aplicativo ou por e-mail quando a mudança for relevante.'],
  },
];

const DOCS: Record<LegalDoc, { title: string; sections: LegalSection[] }> = {
  termos: { title: 'Termos de uso', sections: TERMS },
  privacidade: { title: 'Política de privacidade', sections: PRIVACY },
};

const fill = (text: string): string => text.replaceAll('{{responsavel}}', LEGAL.controllerName).replaceAll('{{email}}', LEGAL.contactEmail);

/** Documento pronto para exibir, com os dados do responsável já preenchidos. */
export function getLegalDoc(doc: LegalDoc): { title: string; sections: LegalSection[] } {
  const d = DOCS[doc];
  return { title: d.title, sections: d.sections.map((s) => ({ title: s.title, paragraphs: s.paragraphs.map(fill) })) };
}

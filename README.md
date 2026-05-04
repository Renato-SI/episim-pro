# 🦠 EpiSim Pro — Plataforma de Modelagem e Previsão Epidemiológica

> Uma plataforma de simulação epidemiológica de nível científico para modelagem de doenças infecciosas com precisão matemática, clareza visual e utilidade para tomada de decisão em saúde pública.

-----

## 📋 Visão Geral

O **EpiSim Pro** é uma plataforma profissional de modelagem epidemiológica baseada em navegador, construída com React e Recharts. Implementa modelos compartimentais validados pela literatura científica — resolvidos numericamente pelo método de Runge-Kutta de 4ª ordem (RK4) — com análise de incerteza via Simulação de Monte Carlo, controles interativos de parâmetros e exportação completa de dados em CSV. Tudo roda inteiramente no navegador, sem necessidade de backend.

Desenvolvido para pesquisadores, profissionais de saúde, educadores e gestores públicos que precisam de uma ferramenta rápida, transparente e reprodutível para simulação de surtos e planejamento de políticas de saúde.

-----

## ✨ Funcionalidades

### Modelos Epidemiológicos

|Modelo     |Compartimentos |Descrição                                             |
|-----------|---------------|------------------------------------------------------|
|**SEIRD+V**|S→E→I→R/D/H + V|Modelo completo com hospitalização, mortes e vacinação|
|**SIR**    |S→I→R          |Modelo clássico de Kermack-McKendrick (1927)          |
|**SEIRS**  |S→E→I→R→S      |Com perda de imunidade e ciclos de reinfecção         |

### Motor Matemático

- **Solver RK4** (Δt = 0,5 dias) para alta precisão numérica
- **Força de infecção** com escalonamento por intervenções
- **Perda de imunidade** e vias de reinfecção
- **Monte Carlo** com análise de incerteza (n=80 corridas estocásticas, perturbação de ±15–30%)
- **Bandas de confiança** do percentil 5 ao 95

### Controles de Parâmetros (15 sliders ajustáveis)

- Taxa de transmissão β, incubação σ, recuperação γ, mortalidade μ
- Taxas de hospitalização e UTI
- Perda de imunidade e fator de reinfecção
- Taxa e eficácia vacinal
- Efetividade de intervenções (redução de contatos)
- Tamanho da população e casos iniciais
- Duração da simulação (30–730 dias)

### Cenários Pré-configurados

|Cenário             |R₀  |CFR |Observações                  |
|--------------------|----|----|-----------------------------|
|COVID-19 (Baseline) |~2,5|0,5%|Cepa Alpha/original          |
|COVID-19 (Omicron)  |~8,0|0,2%|Com cobertura vacinal parcial|
|Influenza (Sazonal) |~1,4|0,1%|Gripe sazonal típica         |
|Sarampo (sem vacina)|~15 |0,2%|Sem vacinação                |
|Ebola (Surto)       |~2,0|45% |Alto CFR, população pequena  |

### Abas do Dashboard

1. **Curvas Epidêmicas** — Infecciosos ativos, incidência diária, mortes e recuperados
1. **Compartimentos** — Fluxo completo da população SEIRD+V
1. **Dinâmica de Rt** — Número reprodutivo efetivo com linha de limiar
1. **Estresse Hospitalar** — Demanda de hospitalizados/UTI vs. capacidade instalada
1. **Grupos Etários** — Impacto estratificado por 6 faixas etárias (curvas de IFR)
1. **Incerteza** — Bandas de confiança Monte Carlo (percentis 5/25/50/75/95)
1. **Tabela de Dados** — Série temporal diária paginada e filtrável
1. **Comparação de Cenários** — Tabela lateral, gráfico sobreposto e barras de CFR

### Exportação de Dados

- **Exportação CSV** pelo botão no cabeçalho (simulação atual)
- **CSV por cenário** na aba Comparação de Cenários
- Filtro de intervalo (a cada 1/7/14/30 dias) na Tabela de Dados

-----

## 🚀 Como Começar

### Pré-requisitos

- Node.js ≥ 16
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Renato-SI/episim-pro.git
cd episim-pro

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm start
```

Acesse <http://localhost:3000> no seu navegador.

### Build de Produção

```bash
npm run build
```

A pasta `build/` contém o site estático otimizado — pronto para deploy no GitHub Pages, Netlify, Vercel ou qualquer host estático.

### Deploy no GitHub Pages

```bash
npm install --save-dev gh-pages

# Adicione ao package.json em "scripts":
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"
# E no nível raiz: "homepage": "https://Renato-SI.github.io/episim-pro"

npm run deploy
```

-----

## 🗂 Estrutura do Projeto

```
episim-pro/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx          # Aplicação completa (arquitetura single-file)
│   └── index.js         # Ponto de entrada React
├── package.json
├── .gitignore
├── PROMPT.md
└── README.md
```

-----

## 🔬 Modelo Matemático

### Equações Diferenciais — SEIRD+V

```
dS/dt = -β·(I/N)·S·φ - ν·S·ε + ξ·R
dE/dt =  β·(I/N)·S·φ - σ·E + δ·γ·R·β·(I/N)·0.3
dI/dt =  σ·E - γ·I - μ·I
dR/dt =  γ·I - ξ·R - δ·γ·R·β·(I/N)·0.3
dD/dt =  μ·I
dH/dt =  h·σ·E - 0.1·H - κ·H
dV/dt =  ν·S·ε
```

|Símbolo|Parâmetro                                 |
|-------|------------------------------------------|
|β      |Taxa de transmissão                       |
|σ      |Taxa de incubação (1/período de incubação)|
|γ      |Taxa de recuperação (1/período infeccioso)|
|μ      |Taxa de mortalidade por caso (CFR)        |
|φ      |Fator de intervenção (redução de contatos)|
|ξ      |Taxa de perda de imunidade                |
|δ      |Fator de suscetibilidade à reinfecção     |
|ν      |Taxa de vacinação diária                  |
|ε      |Eficácia vacinal                          |
|h      |Taxa de hospitalização                    |
|κ      |Taxa de UTI                               |

### Índices Epidemiológicos Chave

```
R₀  = β / (γ + μ)          Número básico de reprodução
Rt  = R₀ · S(t) / N        Número reprodutivo efetivo
HIT = 1 - 1/R₀             Limiar de imunidade coletiva
AR  = 1 - S(∞) / N         Taxa de ataque final
```

-----

## 📊 Stack Tecnológico

|Camada      |Tecnologia                           |
|------------|-------------------------------------|
|Framework UI|React 18                             |
|Gráficos    |Recharts 2.x                         |
|Solver ODE  |RK4 customizado (JS puro)            |
|Estilo      |CSS-in-JS (inline)                   |
|Tipografia  |Inter + JetBrains Mono (Google Fonts)|
|Build       |Create React App                     |
|Exportação  |Blob API (CSV)                       |

Nenhuma biblioteca externa de epidemiologia — todos os modelos foram implementados do zero para garantir total transparência e reprodutibilidade científica.

-----

## ⚠️ Aviso

O EpiSim Pro é uma **ferramenta de pesquisa e ensino**. Não se destina à tomada de decisão clínica, cuidado de pacientes ou políticas oficiais de saúde pública sem revisão epidemiológica especializada. Os resultados dos modelos são sensíveis às premissas dos parâmetros e devem ser interpretados com acompanhamento de especialistas.

-----

## 📄 Licença

Licença MIT — livre para usar, modificar e distribuir com atribuição.

-----

## 🤝 Contribuições

Pull requests são bem-vindos. Para mudanças significativas, abra uma issue primeiro para discutir o que deseja alterar.

Áreas para contribuição:

- Matrizes de contato POLYMOD para estratificação etária realista
- Import de dados reais (APIs da OMS, DATASUS, Our World in Data)
- Variantes adicionais de modelos (SEIQR, modelos de rede)
- Modelos espaciais de metapopulação
- Camada de forecasting com IA/ML

-----

## 👨‍💻 Autor

**Renato Rodrigues Barbosa Filho**
Bacharelado em Sistemas de Informação — UFRPE
Orientador: Prof. Jones Albuquerque

-----

*Desenvolvido com React + Recharts · Integração numérica RK4 · Quantificação de incerteza por Monte Carlo*
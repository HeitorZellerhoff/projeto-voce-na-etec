# RETURN PADRÃO — ORQUESTRADOR

## 1. IDENTIFICAÇÃO

**Tarefa:**
[Nome da tarefa executada]

**Tipo:**
[INVESTIGAÇÃO | IMPLEMENTAÇÃO | CORREÇÃO | REVISÃO | VALIDAÇÃO | TESTE | AUDITORIA]

**Status:**
[CONCLUÍDO | PARCIAL | BLOQUEADO | FALHOU]

**Data:**
[YYYY-MM-DD]

**IA/Agente:**
[Nome ou identificação da IA]

---

## 2. OBJETIVO

Descrever objetivamente o que deveria ser investigado, alterado ou validado.

**Objetivo solicitado:**
[Descrição]

**Resultado esperado:**
[Descrição do comportamento esperado]

---

## 3. RESUMO EXECUTIVO

Descrever em poucas linhas:

* o que foi analisado;
* o que foi encontrado;
* o que foi alterado;
* o que foi validado;
* o que permanece pendente.

**Resumo:**

[Texto]

---

## 4. DIAGNÓSTICO

### Problema

[Descrição precisa do problema]

### Comportamento esperado

[O que deveria acontecer]

### Comportamento encontrado

[O que realmente acontece]

### Causa

**Classificação:**

* [ ] CONFIRMADA
* [ ] PROVÁVEL
* [ ] HIPÓTESE
* [ ] DESCONHECIDA

**Descrição:**

[Explicação da causa]

### Evidências

Listar as evidências utilizadas para chegar à conclusão.

1. `[arquivo/módulo]` — [evidência]
2. `[arquivo/módulo]` — [evidência]
3. `[log/teste/comando]` — [evidência]

---

## 5. ARQUIVOS ANALISADOS

| Arquivo           | Ação         | Motivo   |
| ----------------- | ------------ | -------- |
| `caminho/arquivo` | ANALISADO    | [motivo] |
| `caminho/arquivo` | ALTERADO     | [motivo] |
| `caminho/arquivo` | NÃO ALTERADO | [motivo] |

---

## 6. ALTERAÇÕES REALIZADAS

### Alteração 1

**Arquivo:**
`caminho/arquivo`

**Alteração:**
[Descrição]

**Motivo:**
[Por que a alteração foi necessária]

**Impacto esperado:**
[Descrição]

---

### Alteração 2

**Arquivo:**
`caminho/arquivo`

**Alteração:**
[Descrição]

**Motivo:**
[Por que a alteração foi necessária]

**Impacto esperado:**
[Descrição]

---

## 7. ALTERAÇÕES NÃO REALIZADAS

Registrar explicitamente aquilo que foi analisado, mas deliberadamente não foi alterado.

| Item                       | Motivo   |
| -------------------------- | -------- |
| `[arquivo/funcionalidade]` | [motivo] |
| `[arquivo/funcionalidade]` | [motivo] |

**Importante:** não realizar alterações fora do escopo sem justificativa explícita.

---

## 8. IMPACTO

### Componentes afetados

* [Frontend]
* [Backend]
* [API]
* [Banco de dados]
* [Autenticação]
* [Infraestrutura]
* [Testes]
* [Configuração]
* [Outro]

### Compatibilidade

[Descrever se APIs, contratos, interfaces, banco ou comportamentos existentes foram preservados.]

### Risco

**Nível:**
[BAIXO | MÉDIO | ALTO | CRÍTICO]

**Justificativa:**
[Explicação]

---

## 9. TESTES EXECUTADOS

| Teste   | Comando/Ação | Resultado     | Evidência   |
| ------- | ------------ | ------------- | ----------- |
| [teste] | `[comando]`  | PASSOU/FALHOU | [evidência] |
| [teste] | `[comando]`  | PASSOU/FALHOU | [evidência] |

### Resultado dos testes

**Testes executados:** [N]

**PASSOU:** [N]

**FALHOU:** [N]

**NÃO EXECUTADOS:** [N]

---

## 10. VALIDAÇÃO

### Validações realizadas

* [ ] Compilação
* [ ] Lint
* [ ] Testes unitários
* [ ] Testes de integração
* [ ] Testes funcionais
* [ ] Testes E2E
* [ ] Teste manual
* [ ] Validação de API
* [ ] Validação de banco
* [ ] Validação de regressão

### Resultado

[Descrição objetiva]

### Evidência

[Comando, log, resultado, screenshot, teste ou outra evidência]

---

## 11. REGRESSÃO

Foi verificado se a alteração pode afetar funcionalidades existentes?

**Resultado:**
[SIM — sem regressão encontrada | NÃO — não foi possível validar | REGRESSÃO ENCONTRADA]

**Detalhes:**

[Descrição]

---

## 12. PROBLEMAS ENCONTRADOS DURANTE A EXECUÇÃO

Registrar problemas que:

* já existiam antes da alteração;
* foram introduzidos pela alteração;
* impediram a execução;
* ficaram fora do escopo.

### Problema 1

**Descrição:**
[Descrição]

**Classificação:**
[PRÉ-EXISTENTE | INTRODUZIDO | BLOQUEADOR | FORA DO ESCOPO]

**Evidência:**
[Evidence]

**Ação tomada:**
[Descrição]

---

## 13. PENDÊNCIAS

| Pendência | Motivo   | Prioridade         | Próxima ação |
| --------- | -------- | ------------------ | ------------ |
| [item]    | [motivo] | [BAIXA/MÉDIA/ALTA] | [ação]       |

Se não houver:

**Nenhuma pendência identificada.**

---

## 14. INFORMAÇÕES DESCONHECIDAS

Registrar explicitamente aquilo que não pôde ser confirmado.

* [informação]
* [informação]

**Motivo da ausência:**
[Por que não foi possível confirmar]

---

## 15. CONCLUSÃO

**Resultado final:**

[CONCLUÍDO | PARCIAL | BLOQUEADO | FALHOU]

**Conclusão objetiva:**

[Descrever se o objetivo foi ou não atingido.]

**Importante:** não declarar sucesso apenas porque uma alteração foi realizada. O sucesso deve ser baseado nas evidências de validação.

---

## 16. RECOMENDAÇÃO AO ORQUESTRADOR

Indicar o próximo passo recomendado.

**Próximo passo:**

[VALIDAR | INVESTIGAR | CORRIGIR | REVISAR | TESTAR | APROVAR | BLOQUEAR]

**Justificativa:**

[Motivo baseado nas evidências]

---

## 17. EVIDÊNCIAS COMPLETAS

### Comandos executados

```text
[comando]
[comando]
```

### Resultados relevantes

```text
[resultado]
```

### Logs

```text
[logs relevantes]
```

### Outros artefatos

[links, arquivos, screenshots, relatórios etc.]

---

# REGRAS OBRIGATÓRIAS DO RETURN

1. Não afirmar que algo foi corrigido sem evidência.
2. Não afirmar que testes passaram se não foram executados.
3. Não ocultar erros encontrados.
4. Diferenciar claramente:

   * CONFIRMADO
   * PROVÁVEL
   * HIPÓTESE
   * DESCONHECIDO
5. Informar todos os arquivos alterados.
6. Informar todos os arquivos analisados que poderiam ser relevantes.
7. Explicar por que cada alteração foi necessária.
8. Informar alterações que foram consideradas, mas não realizadas.
9. Informar problemas pré-existentes encontrados.
10. Informar problemas introduzidos pela alteração.
11. Informar testes executados e seus resultados.
12. Informar testes que deveriam ser executados, mas não puderam ser.
13. Não ampliar o escopo sem autorização.
14. Não realizar refatorações não necessárias para resolver o objetivo.
15. Preservar APIs, contratos, interfaces e comportamentos existentes sempre que possível.
16. Quando faltar contexto, declarar explicitamente o que falta.
17. Nunca preencher informações desconhecidas com suposições.
18. Toda conclusão deve possuir evidência correspondente.
19. O status final deve refletir a realidade da execução.
20. Se houver dúvida sobre a solução, declarar a dúvida em vez de assumir que está correta.

---

# FORMATO MÍNIMO PARA RETURNS RÁPIDOS

Quando um return completo não for necessário, utilizar pelo menos:

**STATUS:** [CONCLUÍDO | PARCIAL | BLOQUEADO | FALHOU]

**OBJETIVO:**
[objetivo]

**RESULTADO:**
[resultado]

**CAUSA/DIAGNÓSTICO:**
[causa]

**ALTERAÇÕES:**
[arquivos e alterações]

**EVIDÊNCIAS:**
[testes/logs/resultados]

**RISCOS:**
[riscos]

**PENDÊNCIAS:**
[pendências]

**PRÓXIMO PASSO:**
[ação recomendada]

**VALIDAÇÃO:**
[como foi ou será validado]

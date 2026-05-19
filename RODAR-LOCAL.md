# 🚀 Como rodar o Facilita PrEP no seu computador

Guia passo-a-passo para subir o site **100% local** — você navega tudo no seu navegador, sem depender de nada na internet.

## ✅ O que você vai precisar instalar (só uma vez)

| Programa           | Para que serve                          | Onde baixar                                     |
| ------------------ | --------------------------------------- | ----------------------------------------------- |
| **Node.js 20+**    | Roda o JavaScript do site               | https://nodejs.org (escolha a versão LTS)       |
| **pnpm**           | Gerenciador de pacotes (depois do Node) | No terminal: `npm install -g pnpm`              |
| **Git**            | Para baixar o código                    | https://git-scm.com                             |
| **Docker Desktop** | Sobe banco de dados + Redis + storage   | https://www.docker.com/products/docker-desktop/ |

> **Windows:** Docker Desktop pede para ativar o WSL2 — siga o assistente, ele faz tudo sozinho.
> **Mac:** baixe a versão correta para o seu chip (Apple Silicon ou Intel).
> **Linux:** instale Docker Engine + Docker Compose pelo gerenciador da sua distro.

---

## 📥 Passo 1 — Baixar o código

Abra o **terminal** (no Windows: PowerShell ou Prompt; no Mac/Linux: Terminal) e rode:

```bash
git clone https://github.com/wercijr-blip/claude-test.git facilita-prep
cd facilita-prep
git checkout claude/review-facilita-prep-setup-ZDKky
```

---

## ⚙️ Passo 2 — Criar o arquivo `.env`

Copie o arquivo de exemplo:

**Windows (PowerShell):**

```powershell
Copy-Item .env.exemplo .env
```

**Mac / Linux:**

```bash
cp .env.exemplo .env
```

> Já vem tudo preenchido com valores que funcionam com o Docker. Só precisa editar se quiser testar pagamento, e-mail real, etc.

---

## 🐳 Passo 3 — Subir banco + Redis + storage (Docker)

Certifique-se que o **Docker Desktop está aberto** e rode no terminal (dentro da pasta do projeto):

```bash
docker compose up -d
```

Vai baixar e subir 3 serviços:

- **MySQL** (banco de dados) — porta 3306
- **Redis** (filas) — porta 6379
- **MinIO** (storage S3 local) — portas 9000 e 9001

Para verificar que tudo subiu, rode:

```bash
docker compose ps
```

Todos devem aparecer com status `Up` ou `running`.

---

## 📦 Passo 4 — Instalar dependências do projeto

```bash
pnpm install
```

(leva 1-2 minutos na primeira vez)

---

## 🗄️ Passo 5 — Criar as tabelas no banco

```bash
pnpm db:push
```

Vai pedir confirmação — digite `y` e pressione Enter.

---

## ▶️ Passo 6 — Rodar o site

```bash
pnpm dev
```

Vai aparecer algo como:

```
✓ Servidor rodando em http://localhost:3000
✓ Vite em http://localhost:5173
```

Abra no navegador: **http://localhost:5173**

---

## 🧭 Rotas para validar cada etapa

| URL                              | O que você vê                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `http://localhost:5173/`         | Página inicial — hero, escolha particular/plano, lista de convênios, "Como utilizar" |
| `http://localhost:5173/duvidas`  | Landing FAQ completo — PrEP, vacinação, exames, UDM, etc.                            |
| `http://localhost:5173/cadastro` | Mesma página inicial                                                                 |
| `http://localhost:5173/inicio`   | Fluxo do paciente — escolha de tipo de consulta, exame, validação                    |
| `http://localhost:5173/login`    | Tela de login (equipe)                                                               |

---

## 🛑 Como parar tudo

```bash
# Para o site (no terminal onde rodou pnpm dev):
Ctrl + C

# Para os serviços do Docker:
docker compose down

# Para apagar TODOS os dados e começar do zero:
docker compose down -v
```

---

## ❓ Problemas comuns

**"docker: command not found"**
→ Docker Desktop não está rodando. Abra ele e aguarde aparecer "Docker Desktop is running".

**"Port 3306 is already in use"**
→ Você já tem um MySQL local rodando. Pare ele ou edite o `docker-compose.yml` mudando `"3306:3306"` para `"3307:3306"` e ajuste o `.env`: `mysql://...@127.0.0.1:3307/...`

**"pnpm: command not found"**
→ Reabra o terminal depois de instalar o pnpm. Ou rode `npm install -g pnpm` novamente.

**Site abre mas dá erro de cadastro/pagamento**
→ Normal! Em local, faltam credenciais reais do Stripe e do Gmail. O fluxo visual funciona, só não dá para finalizar pagamento de verdade.

**Quer ver o banco de dados?**
→ Rode `pnpm exec drizzle-kit studio` — abre uma interface web em http://localhost:4983 para inspecionar/editar os dados.

---

## 📞 Onde pedir ajuda

Se travar em algum passo, me mande o que apareceu no terminal — eu te ajudo a destravar.

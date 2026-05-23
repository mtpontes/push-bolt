# Carrega variáveis do arquivo .env se ele existir
ifneq ("$(wildcard .env)","")
    include .env
    export
endif

.PHONY: build-backend deploy deploy-all destroy update-env check-env check-build

check-env:
	@echo "Verificando usuário AWS atual..."
	aws sts get-caller-identity
# Detecta se está no Windows (CMD/PowerShell) ou Unix/Bash
ifeq ($(OS),Windows_NT)
    MVNW := mvnw.cmd
    RM := del /f /q
else
    MVNW := ./mvnw
    RM := rm -f
endif

# Comando padrão
all: deploy

build-backend:
	@echo "Limpando e compilando backend (Native via Docker Container)..."
	cd backend && $(MVNW) clean package -Dnative -DskipTests -Dquarkus.native.container-build=true

check-build:
	@node -e "if(!require('fs').existsSync('backend/target/function.zip')) { console.error('ERRO: Build do backend (backend/target/function.zip) não encontrado.'); console.error('Execute \'make build-backend\' primeiro, ou utilize \'make deploy-all\' para compilar e publicar.'); process.exit(1); }"

generate-oauth-json:
	@echo "Gerando credentials/google-oauth-crendentials.json a partir do ambiente..."
	@node -e "const fs = require('fs'); if (!fs.existsSync('credentials')) fs.mkdirSync('credentials'); fs.writeFileSync('credentials/google-oauth-crendentials.json', JSON.stringify({ web: { client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '' } }, null, 2));"

deploy-all: build-backend deploy

deploy: check-build generate-oauth-json
	@echo "Instalando dependências de infraestrutura..."
	cd infra && npm install
	@echo "Preparando ambiente AWS (CDK Bootstrap)..."
	cd infra && npx cdk bootstrap
	@echo "Fazendo deploy da infraestrutura na AWS..."
	cd infra && npx cdk deploy --all --require-approval never --outputs-file outputs.json
	@$(MAKE) update-env

destroy:
	@echo "DESTRUINDO todos os recursos na AWS..."
	cd infra && npx cdk destroy --all --force

update-env:
	@echo "Atualizando variáveis de ambiente do frontend..."
	node ./scripts/update-frontend-env.js

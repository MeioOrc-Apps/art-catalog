#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Uso: ./release.sh <nova-versao> (ex: ./release.sh v0.1.8)"
  exit 1
fi

VERSION=$1

echo "Atualizando docker-compose.zimaos.yml para $VERSION..."

# Atualiza docker-compose.zimaos.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-api:.*|image: ghcr.io/sergiosjs/art-catalog-api:${VERSION}|g" docker-compose.zimaos.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-frontend:.*|image: ghcr.io/sergiosjs/art-catalog-frontend:${VERSION}|g" docker-compose.zimaos.yml
rm -f docker-compose.zimaos.yml.bak

echo "Commitando alterações..."
git add docker-compose.zimaos.yml
git commit -m "chore: bump version to $VERSION"

echo "Criando tag $VERSION..."
git tag $VERSION

echo "Enviando para o GitHub..."
git push origin main
git push origin $VERSION

echo "Release $VERSION concluído com sucesso!"
echo "Lembre-se de atualizar a tag no seu repositório da App Store do CasaOS!"

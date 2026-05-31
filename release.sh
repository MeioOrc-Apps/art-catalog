#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Uso: ./release.sh <nova-versao> (ex: ./release.sh v0.1.8)"
  exit 1
fi

VERSION=$1

echo "Atualizando docker-compose.zimaos.yml e Apps/ArtCatalog/docker-compose.yml para $VERSION..."

# Atualiza docker-compose.zimaos.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-api:.*|image: ghcr.io/sergiosjs/art-catalog-api:${VERSION}|g" docker-compose.zimaos.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-frontend:.*|image: ghcr.io/sergiosjs/art-catalog-frontend:${VERSION}|g" docker-compose.zimaos.yml
rm -f docker-compose.zimaos.yml.bak

# Atualiza Apps/ArtCatalog/docker-compose.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-api:.*|image: ghcr.io/sergiosjs/art-catalog-api:${VERSION}|g" Apps/ArtCatalog/docker-compose.yml
sed -i.bak -E "s|image: ghcr.io/sergiosjs/art-catalog-frontend:.*|image: ghcr.io/sergiosjs/art-catalog-frontend:${VERSION}|g" Apps/ArtCatalog/docker-compose.yml
rm -f Apps/ArtCatalog/docker-compose.yml.bak

echo "Commitando alterações..."
git add docker-compose.zimaos.yml Apps/ArtCatalog/docker-compose.yml
git commit -m "chore: bump version to $VERSION"

echo "Criando tag $VERSION..."
git tag $VERSION

echo "Enviando para o GitHub..."
git push origin main
git push origin $VERSION

echo "Release $VERSION concluído com sucesso!"

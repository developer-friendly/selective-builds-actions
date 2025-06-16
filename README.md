# Selective Build Actions

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Selective Build Actions](#selective-build-actions)
  - [Example - Build Docker](#example---build-docker)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

This action will perform a hash function on the first depth of directories
specified at `path`, calculate a unique SHA256 hash on the files inside, and
generate a unique string for each directory.

It then uses that string to compare future CI runs against he one computed
before, signaling a change in the target directory, possibly allowing a further
job to execute a build of the application in the change directory.

It is useful for selective builds on monorepos when it is desired and costly
justified to build only the directories that have changed.

It does not hold any opinions on how you build your apps; you are free to pick
whatever's best for your stack. However, for the purpose of demonstration, you
will find a Docker build example below.

This action relies on GitHub Action's dynamic
[matrix](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-a-matrix-for-your-jobs),
a topic that has been covered in
[here](https://developer-friendly.blog/2024/03/09/github-actions-dynamic-matrix/).

## Example - Build Docker

```yaml
name: ci

on:
  push:
    branches:
      - main
  schedule:
    - cron: "0 0 * * *"

jobs:
  prepare:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      matrix: ${{ steps.matrix.outputs.matrix }}
      length: ${{ steps.matrix.outputs.length }}
    steps:
      - uses: actions/checkout@v4
        name: Checkout
      - id: matrix
        name: Discover changed services
        uses: developer-friendly/selective-builds-actions@v1
        with:
          redis-host: ${{ secrets.REDIS_HOST }}
          redis-port: ${{ secrets.REDIS_PORT }}
          redis-password: ${{ secrets.REDIS_PASSWORD }}
          redis-ssl: ${{ secrets.REDIS_SSL }}
          exclusions: |
            .git
            .github
          inclusions: |
            frontend
            backend
            api

  build:
    needs: prepare
    runs-on: ubuntu-latest
    if: needs.prepare.outputs.length > 0
    strategy:
      fail-fast: false
      matrix: ${{ fromJson(needs.prepare.outputs.matrix) }}
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          password: ${{ secrets.GITHUB_TOKEN }}
          registry: ghcr.io
          username: ${{ github.actor }}
      - name: Pre-process image name
        id: image-name
        run: |
          name=$(echo ${{ matrix.directory }} | sed 's/.*\///')
          echo "name=$name" >> $GITHUB_OUTPUT
      - id: meta
        name: Docker metadata
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ steps.image-name.outputs.name }}
      - id: build-push
        name: Build and push
        uses: docker/build-push-action@v6
        with:
          cache-from: type=gha
          cache-to: type=gha,mode=max
          context: ${{ matrix.directory }}
          labels: ${{ steps.meta.outputs.labels }}
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ steps.meta.outputs.tags }}

  finalize:
    runs-on: ubuntu-latest
    needs: build
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        name: Checkout
      - id: matrix
        name: Discover changed services
        uses: developer-friendly/selective-builds-actions@v1
        with:
          redis-host: ${{ secrets.REDIS_HOST }}
          redis-port: ${{ secrets.REDIS_PORT }}
          redis-password: ${{ secrets.REDIS_PASSWORD }}
          redis-ssl: ${{ secrets.REDIS_SSL }}
          mode: submit
          exclusions: |
            .git
            .github
          inclusions: |
            frontend
            backend
            api
```

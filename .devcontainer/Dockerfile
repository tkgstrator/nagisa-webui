FROM mcr.microsoft.com/devcontainers/base:dev-ubuntu22.04

# ~/.vscode-server/extensions は compose の named volume (拡張をリビルドを跨いで残す)。
# マウント先がイメージに無いと Docker が掘るので、extensions だけでなく親の
# ~/.vscode-server まで root 所有になり、vscode で動く VS Code server が data/logs を
# 作れずに死ぬ。イメージ側に vscode 所有で先に掘っておくと、Docker はボリューム
# 初期化時にその所有者をコピーする。
#
# postCreate の chown では間に合わない。server が ~/.vscode-server を作るのは
# postCreate 1 行目より 3.7 秒早い (実測: 16:28:22.03 対 16:28:25.76)。
RUN mkdir -p /home/vscode/.vscode-server/extensions \
 && chown -R vscode:vscode /home/vscode/.vscode-server

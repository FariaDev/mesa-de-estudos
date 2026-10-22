import Base
import dialogsview.bend as D

# ---------------------------------------------------------------------------
# Primeira abertura (tickets #21 e #64). Módulo só da Mesa: a Conversa não
# importa daqui e este artefato não é gerado para ela.
#
# Desde a #64 a primeira abertura é uma tela cheia de passos (boas-vindas,
# como a Mesa funciona, nome, PDFs, tutor e pronto). Pela ADR 0001 os passos,
# os textos e as árvores de interface moram em JS com teste
# (`desk/src/setup-flow.mjs` e `desk/src/first-run.mjs`); a folha "Lista 0", os
# rótulos e a árvore do tutor que estavam aqui saíram. Fica o que, se quebrar,
# faz o app criar o que não devia ou o aluno perder algo:
#
#   - qual primeira abertura vale ("setup", "empty" ou nenhuma: quem tem
#     matéria nunca a vê);
#   - o que falta para criar a matéria: SÓ cria com nome e pasta de PDFs;
#   - o id da matéria que nasce (a mesma regra das Configurações);
#   - a pasta de dados que a criação confirma ("empty" não a regrava).
#
# Fronteira de host: o aplicador lê o campo, a pasta e os fatos e fala IPC.
# Nada aqui lê o DOM, cria pasta ou grava `config.json`.
# ---------------------------------------------------------------------------

# ---------- quando a primeira abertura vale ----------

def kindSetup() -> String:
  "setup"

def kindEmpty() -> String:
  "empty"

def entry.noCourses(needsSetup: Bool) -> String:
  match needsSetup:
    case True{}:
      kindSetup()
    case False{}:
      kindEmpty()

# Qual primeira abertura vale: "setup" (sem configuração; a pasta de dados ainda
# vai ser confirmada), "empty" (pasta de dados válida e nenhuma matéria, por
# exemplo depois de apagar todas nas Configurações; a pasta de dados NÃO é
# pedida de novo) ou "" (há matéria: nunca se vê a folha). `needsSetup` é o do
# host (`core/config.bend`); `hasCourses` diz se existe alguma matéria de
# verdade — a aba Livre não conta.
def entry(+needsSetup: Bool, +hasCourses: Bool) -> String:
  match hasCourses:
    case True{}:
      ""
    case False{}:
      entry.noCourses(needsSetup)

# ---------- o que falta ----------

def isBlank(s: String) -> Bool:
  String.is_empty(String.trim(s))

def missing.noName(noFolder: Bool) -> String:
  match noFolder:
    case True{}:
      "both"
    case False{}:
      "name"

def missing.hasName(noFolder: Bool) -> String:
  match noFolder:
    case True{}:
      "folder"
    case False{}:
      ""

def missing.pick(noName: Bool, noFolder: Bool) -> String:
  match noName:
    case True{}:
      missing.noName(noFolder)
    case False{}:
      missing.hasName(noFolder)

# "both" | "name" | "folder" | "" (nada falta). O nome e a pasta em branco
# (só espaços) contam como ausentes.
def missing(+name: String, +folder: String) -> String:
  missing.pick(isBlank(name), isBlank(folder))

def canCreate(name: String, folder: String) -> Bool:
  String.eq(missing(name, folder), "")

# ---------- id da matéria ----------

def courseId.pick(blank: Bool, name: String, folder: String) -> String:
  match blank:
    case True{}:
      D.fileBase(folder)
    case False{}:
      name

# O nome aparado; sem nome, o nome da pasta. É o mesmo id que o formulário das
# Configurações dá à linha de matéria.
def courseId(+name: String, +folder: String) -> String:
  courseId.pick(isBlank(name), String.trim(name), String.trim(folder))

# ---------- a pasta de dados ----------

def dataToConfirm.pick(known: Bool, dataFolder: String) -> String:
  match known:
    case True{}:
      ""
    case False{}:
      dataFolder

# A pasta de dados que a criação da matéria confirma (cria e grava como
# `vaultPath`). Em "empty" a pasta de dados já valia: não há o que confirmar
# ("") e a configuração não a regrava.
def dataToConfirm(+kind: String, dataFolder: String) -> String:
  dataToConfirm.pick(String.eq(kind, kindEmpty()), dataFolder)

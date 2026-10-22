import Base
import ../phonedrop.bend as P

# ---------------------------------------------------------------------------
# Contrato da Foto do celular (ticket #36). Prefixo `phone_`.
#
#   1. fluxo: Iniciar sempre recomeça esperando, do zero; foto só conta com o
#      servidor de pé; Parar e o tempo sem uso fecham e guardam a contagem; o
#      que fecha nunca fica de pé;
#   2. porta: servidor parado, token errado ou caminho desconhecido dão o mesmo
#      "fechado" (404); só a página e o envio abrem;
#   3. foto: só JPEG, PNG e WebP, nunca vazia; teto por arquivo (15 MB) e por
#      sessão (12 fotos, 100 MB); servidor parado no meio do envio é 404.
#
# O que o enunciado NÃO prova: comparar o token em tempo constante, reconhecer
# a imagem pelos primeiros bytes, contar os bytes do corpo, ler o relógio,
# escolher a interface de rede e tirar o EXIF. Tudo isso é do host
# (`desk/phone-host.cjs`, `desk/phone-image.cjs`) e tem teste de host contra o
# servidor real em `tests/phone-host.test.mjs`. Os números são cenários
# concretos (U32 não reduz em geral), escolhidos na fronteira de cada teto.
# ---------------------------------------------------------------------------

# ---------- fluxo ----------

law phone_iniciar_sempre_espera:
  for f: P.Flow
  {P.step(f, P.EvStart{}) == P.PhoneWaiting{} : P.Flow}

law phone_primeira_foto_conta_um:
  {P.step(P.PhoneWaiting{}, P.EvPhoto{}) == P.PhoneReceived{1} : P.Flow}

law phone_foto_soma_um:
  {P.step(P.PhoneReceived{3}, P.EvPhoto{}) == P.PhoneReceived{4} : P.Flow}

law phone_foto_desligado_nao_conta:
  {P.step(P.PhoneOff{}, P.EvPhoto{}) == P.PhoneOff{} : P.Flow}

law phone_foto_parado_nao_conta:
  {P.step(P.PhoneStopped{2}, P.EvPhoto{}) == P.PhoneStopped{2} : P.Flow}

law phone_foto_expirado_nao_conta:
  {P.step(P.PhoneExpired{2}, P.EvPhoto{}) == P.PhoneExpired{2} : P.Flow}

law phone_foto_erro_nao_conta:
  {P.step(P.PhoneNetError{}, P.EvPhoto{}) == P.PhoneNetError{} : P.Flow}

law phone_parar_guarda_a_contagem:
  {P.step(P.PhoneReceived{2}, P.EvStop{}) == P.PhoneStopped{2} : P.Flow}

law phone_parar_esperando_guarda_zero:
  {P.step(P.PhoneWaiting{}, P.EvStop{}) == P.PhoneStopped{0} : P.Flow}

law phone_expirar_guarda_a_contagem:
  {P.step(P.PhoneReceived{2}, P.EvIdle{}) == P.PhoneExpired{2} : P.Flow}

law phone_parar_desligado_fica_desligado:
  {P.step(P.PhoneOff{}, P.EvStop{}) == P.PhoneOff{} : P.Flow}

law phone_erro_de_rede_vale_de_qualquer_estado:
  for f: P.Flow
  {P.step(f, P.EvFail{}) == P.PhoneNetError{} : P.Flow}

# O que Parar fecha nunca fica de pé, de qualquer estado.
law phone_parar_nunca_fica_de_pe:
  for f: P.Flow
  {P.running(P.step(f, P.EvStop{})) == False{} : Bool}

# O mesmo para o tempo sem uso.
law phone_expirar_nunca_fica_de_pe:
  for f: P.Flow
  {P.running(P.step(f, P.EvIdle{})) == False{} : Bool}

law phone_de_pe_esperando:
  {P.running(P.PhoneWaiting{}) == True{} : Bool}

law phone_de_pe_recebendo:
  {P.running(P.PhoneReceived{5}) == True{} : Bool}

# ---------- porta ----------

law phone_porta_servidor_parado_fecha:
  for token: Bool
  for r: P.Route
  {P.door(False{}, token, r) == P.DoorClosed{} : P.Door}

law phone_porta_sem_token_fecha:
  for up: Bool
  for r: P.Route
  {P.door(up, False{}, r) == P.DoorClosed{} : P.Door}

law phone_porta_caminho_desconhecido_fecha:
  for up: Bool
  for token: Bool
  {P.door(up, token, P.OtherRoute{}) == P.DoorClosed{} : P.Door}

law phone_porta_pagina_abre:
  {P.door(True{}, True{}, P.PageRoute{}) == P.DoorPage{} : P.Door}

law phone_porta_envio_abre:
  {P.door(True{}, True{}, P.UploadRoute{}) == P.DoorUpload{} : P.Door}

# ---------- foto ----------

law phone_foto_servidor_parado_some:
  for k: P.ImageKind
  {P.photo(False{}, k, 5000, 0, 0) == P.PhotoGone{} : P.Verdict}

law phone_foto_jpeg_aceita:
  {P.photo(True{}, P.KindJpeg{}, 5000, 0, 0) == P.PhotoAccept{} : P.Verdict}

law phone_foto_png_aceita:
  {P.photo(True{}, P.KindPng{}, 5000, 0, 0) == P.PhotoAccept{} : P.Verdict}

law phone_foto_webp_aceita:
  {P.photo(True{}, P.KindWebp{}, 5000, 0, 0) == P.PhotoAccept{} : P.Verdict}

law phone_foto_nao_imagem_recusa:
  {P.photo(True{}, P.KindNotImage{}, 5000, 0, 0) == P.PhotoWrongType{} : P.Verdict}

law phone_foto_vazia_recusa:
  {P.photo(True{}, P.KindJpeg{}, 0, 0, 0) == P.PhotoWrongType{} : P.Verdict}

law phone_foto_no_teto_aceita:
  {P.photo(True{}, P.KindJpeg{}, 15728640, 0, 0) == P.PhotoAccept{} : P.Verdict}

law phone_foto_um_byte_acima_recusa:
  {P.photo(True{}, P.KindJpeg{}, 15728641, 0, 0) == P.PhotoTooLarge{} : P.Verdict}

law phone_sessao_decima_segunda_aceita:
  {P.photo(True{}, P.KindPng{}, 5000, 11, 0) == P.PhotoAccept{} : P.Verdict}

law phone_sessao_decima_terceira_recusa:
  {P.photo(True{}, P.KindPng{}, 5000, 12, 0) == P.PhotoFull{} : P.Verdict}

law phone_sessao_bytes_no_teto_aceita:
  {P.photo(True{}, P.KindJpeg{}, 5000, 3, 104852600) == P.PhotoAccept{} : P.Verdict}

law phone_sessao_bytes_acima_recusa:
  {P.photo(True{}, P.KindJpeg{}, 5001, 3, 104852600) == P.PhotoFull{} : P.Verdict}

# ---------- limites e status ----------

law phone_teto_por_foto_15mb:
  {P.maxFileBytes() == 15728640 : U32}

law phone_teto_de_fotos_por_sessao:
  {P.maxSessionPhotos() == 12 : U32}

law phone_teto_de_bytes_por_sessao:
  {P.maxSessionBytes() == 104857600 : U32}

law phone_desliga_com_10_minutos:
  {P.idleMs() == 600000 : U32}

law phone_status_aceita_201:
  {P.verdictStatus(P.PhotoAccept{}) == 201 : U32}

# Servidor parado responde como token errado: 404, sem dizer que existiu.
law phone_status_parado_404:
  {P.verdictStatus(P.PhotoGone{}) == 404 : U32}

law phone_status_tipo_415:
  {P.verdictStatus(P.PhotoWrongType{}) == 415 : U32}

law phone_status_grande_413:
  {P.verdictStatus(P.PhotoTooLarge{}) == 413 : U32}

law phone_status_cheia_413:
  {P.verdictStatus(P.PhotoFull{}) == 413 : U32}

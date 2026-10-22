import Base
import ../phonedrop.bend as P
import ../laws/phonedrop.bend as Laws

# Provas da Foto do celular (ticket #36). Aceitador: `bend proofs/phonedrop.bend`.
# Cenários concretos fecham por computação; os quantificados abrem os casos.

def Laws.phone_iniciar_sempre_espera(f):
  match f:
    case P.PhoneOff{}:
      {==}
    case P.PhoneWaiting{}:
      {==}
    case P.PhoneReceived{count}:
      {==}
    case P.PhoneStopped{count}:
      {==}
    case P.PhoneExpired{count}:
      {==}
    case P.PhoneNetError{}:
      {==}

def Laws.phone_primeira_foto_conta_um():
  {==}

def Laws.phone_foto_soma_um():
  {==}

def Laws.phone_foto_desligado_nao_conta():
  {==}

def Laws.phone_foto_parado_nao_conta():
  {==}

def Laws.phone_foto_expirado_nao_conta():
  {==}

def Laws.phone_foto_erro_nao_conta():
  {==}

def Laws.phone_parar_guarda_a_contagem():
  {==}

def Laws.phone_parar_esperando_guarda_zero():
  {==}

def Laws.phone_expirar_guarda_a_contagem():
  {==}

def Laws.phone_parar_desligado_fica_desligado():
  {==}

def Laws.phone_erro_de_rede_vale_de_qualquer_estado(f):
  match f:
    case P.PhoneOff{}:
      {==}
    case P.PhoneWaiting{}:
      {==}
    case P.PhoneReceived{count}:
      {==}
    case P.PhoneStopped{count}:
      {==}
    case P.PhoneExpired{count}:
      {==}
    case P.PhoneNetError{}:
      {==}

def Laws.phone_parar_nunca_fica_de_pe(f):
  match f:
    case P.PhoneOff{}:
      {==}
    case P.PhoneWaiting{}:
      {==}
    case P.PhoneReceived{count}:
      {==}
    case P.PhoneStopped{count}:
      {==}
    case P.PhoneExpired{count}:
      {==}
    case P.PhoneNetError{}:
      {==}

def Laws.phone_expirar_nunca_fica_de_pe(f):
  match f:
    case P.PhoneOff{}:
      {==}
    case P.PhoneWaiting{}:
      {==}
    case P.PhoneReceived{count}:
      {==}
    case P.PhoneStopped{count}:
      {==}
    case P.PhoneExpired{count}:
      {==}
    case P.PhoneNetError{}:
      {==}

def Laws.phone_de_pe_esperando():
  {==}

def Laws.phone_de_pe_recebendo():
  {==}

def Laws.phone_porta_servidor_parado_fecha(token, r):
  match token:
    case True{}:
      match r:
        case P.PageRoute{}:
          {==}
        case P.UploadRoute{}:
          {==}
        case P.OtherRoute{}:
          {==}
    case False{}:
      match r:
        case P.PageRoute{}:
          {==}
        case P.UploadRoute{}:
          {==}
        case P.OtherRoute{}:
          {==}

def Laws.phone_porta_sem_token_fecha(up, r):
  match up:
    case True{}:
      match r:
        case P.PageRoute{}:
          {==}
        case P.UploadRoute{}:
          {==}
        case P.OtherRoute{}:
          {==}
    case False{}:
      match r:
        case P.PageRoute{}:
          {==}
        case P.UploadRoute{}:
          {==}
        case P.OtherRoute{}:
          {==}

def Laws.phone_porta_caminho_desconhecido_fecha(up, token):
  match up:
    case True{}:
      match token:
        case True{}:
          {==}
        case False{}:
          {==}
    case False{}:
      match token:
        case True{}:
          {==}
        case False{}:
          {==}

def Laws.phone_porta_pagina_abre():
  {==}

def Laws.phone_porta_envio_abre():
  {==}

def Laws.phone_foto_servidor_parado_some(k):
  match k:
    case P.KindJpeg{}:
      {==}
    case P.KindPng{}:
      {==}
    case P.KindWebp{}:
      {==}
    case P.KindNotImage{}:
      {==}

def Laws.phone_foto_jpeg_aceita():
  {==}

def Laws.phone_foto_png_aceita():
  {==}

def Laws.phone_foto_webp_aceita():
  {==}

def Laws.phone_foto_nao_imagem_recusa():
  {==}

def Laws.phone_foto_vazia_recusa():
  {==}

def Laws.phone_foto_no_teto_aceita():
  {==}

def Laws.phone_foto_um_byte_acima_recusa():
  {==}

def Laws.phone_sessao_decima_segunda_aceita():
  {==}

def Laws.phone_sessao_decima_terceira_recusa():
  {==}

def Laws.phone_sessao_bytes_no_teto_aceita():
  {==}

def Laws.phone_sessao_bytes_acima_recusa():
  {==}

def Laws.phone_teto_por_foto_15mb():
  {==}

def Laws.phone_teto_de_fotos_por_sessao():
  {==}

def Laws.phone_teto_de_bytes_por_sessao():
  {==}

def Laws.phone_desliga_com_10_minutos():
  {==}

def Laws.phone_status_aceita_201():
  {==}

def Laws.phone_status_parado_404():
  {==}

def Laws.phone_status_tipo_415():
  {==}

def Laws.phone_status_grande_413():
  {==}

def Laws.phone_status_cheia_413():
  {==}

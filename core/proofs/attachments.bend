import Base
import ../laws/attachments.bend as Laws
import ../attachments.bend as A

# Provas das leis da política de anexos. Aceitador: `bend proofs/attachments.bend`
# deve imprimir "All terms check.". Como os fatos chegam como Bool e as decisões
# só casam com eles, quase toda lei reduz direto ({==}); as listas simbólicas
# (caudas) também reduzem porque o corte de 4 acontece antes de qualquer leitura
# da cauda.

# ---------------------------------------------------------------------------
# Limites
# ---------------------------------------------------------------------------

def Laws.limit_images():
  {==}

def Laws.limit_files():
  {==}

def Laws.limit_name():
  {==}

def Laws.limit_draft_chars():
  {==}

def Laws.limit_text_chars():
  {==}

def Laws.limit_raw_bytes():
  {==}

def Laws.limit_send_bytes():
  {==}

def Laws.limit_total_bytes():
  {==}

# ---------------------------------------------------------------------------
# Nome
# ---------------------------------------------------------------------------

def Laws.name_default():
  {==}

def Laws.name_keeps():
  {==}

def Laws.name_scrubs():
  {==}

def Laws.name_cut():
  {==}

def Laws.name_scrub_cut():
  {==}

# ---------------------------------------------------------------------------
# Tipo
# ---------------------------------------------------------------------------

def Laws.mime_png():
  {==}

def Laws.mime_jpeg():
  {==}

def Laws.mime_jpg():
  {==}

def Laws.mime_webp():
  {==}

def Laws.mime_gif():
  {==}

def Laws.mime_svg():
  {==}

def Laws.mime_empty():
  {==}

def Laws.canon_jpg():
  {==}

def Laws.canon_jpeg_kept():
  {==}

def Laws.canon_png_kept():
  {==}

# ---------------------------------------------------------------------------
# Conteúdo: imagem da parte
# ---------------------------------------------------------------------------

def Laws.part_image_url(url, data):
  {==}

def Laws.part_image_data(data):
  {==}

def Laws.part_image_kind_gate(url):
  {==}

def Laws.part_image_payload_gate():
  {==}

# ---------------------------------------------------------------------------
# Conteúdo: contentParts
# ---------------------------------------------------------------------------

def Laws.content_string_text(s):
  {==}

def Laws.content_string_images(s):
  {==}

def Laws.content_empty():
  {==}

def Laws.content_text_single():
  {==}

def Laws.content_text_join():
  {==}

def Laws.content_text_skips_image():
  {==}

def Laws.content_text_blank_counts():
  {==}

def Laws.content_image_url():
  {==}

def Laws.content_image_data():
  {==}

def Laws.content_image_mime_default():
  {==}

def Laws.content_image_url_wins():
  {==}

def Laws.content_image_order():
  {==}

def Laws.content_image_skips():
  {==}

# ---------------------------------------------------------------------------
# Rascunho
# ---------------------------------------------------------------------------

def Laws.draft_empty():
  {==}

def Laws.draft_image_ok(d):
  {==}

def Laws.draft_image_order(d1, d2):
  {==}

def Laws.draft_image_big(d):
  {==}

def Laws.draft_image_invalid(d):
  {==}

def Laws.draft_image_type():
  {==}

def Laws.draft_image_cap(d, rest):
  {==}

def Laws.draft_file_ok():
  {==}

def Laws.draft_file_default_name():
  {==}

def Laws.draft_file_empty_skipped():
  {==}

def Laws.draft_file_big(t):
  {==}

def Laws.draft_file_cap(rest):
  {==}

def Laws.draft_image_error_first(d):
  {==}

def Laws.draft_error_stops_files():
  {==}

def Laws.draft_reason_ok():
  {==}

def Laws.draft_reason_bad():
  {==}

# ---------------------------------------------------------------------------
# Envio
# ---------------------------------------------------------------------------

def Laws.send_empty():
  {==}

def Laws.send_ok():
  {==}

def Laws.send_jpg_canon():
  {==}

def Laws.send_order():
  {==}

def Laws.send_invalid():
  {==}

def Laws.send_type():
  {==}

def Laws.send_raw_big():
  {==}

def Laws.send_reduce_big():
  {==}

def Laws.send_total_big():
  {==}

def Laws.send_priority():
  {==}

def Laws.send_type_priority():
  {==}

def Laws.send_cap(rest):
  {==}

def Laws.send_first_error():
  {==}

// GERADO de core/attachments.bend por `bun core/build.mjs` — não editar à mão.
// core/attachments.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "�");
}
function str_in(s) {
  return s.replace(/\p{Cs}/gu, "�");
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
var $0eff = Object.create(null);
function $maxImages() {
  return 4;
}
function $maxFiles() {
  return 4;
}
function $maxNameChars() {
  return 120;
}
function $maxDraftChars() {
  const _x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxTextChars() {
  return 80000;
}
function $maxRawBytes() {
  const _x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxSendBytes() {
  const _x_0 = Math.imul(8, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxTotalBytes() {
  const _x_0 = Math.imul(28, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $defaultImageName() {
  return "imagem";
}
function $defaultFileName() {
  return "anexo";
}
function $defaultImageMime() {
  return "image/png";
}
function $scrubChar_go(_c_0, _code_0) {
  if (_code_0 == 10) {
    return " ";
  } else if ((_code_0 & 1) == 0) {
    return _c_0;
  } else if (_code_0 == 13) {
    return " ";
  } else {
    return _c_0;
  }
}
function $scrubChar(_c_0) {
  return $scrubChar_go(_c_0, $Char_to_u32(_c_0));
}
function $scrubName_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return $String_reverse(_acc_0);
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = $scrubChar(_h_0) + _acc_0;
        continue;
      }
    }
  }
}
function $scrubName(_s_0) {
  return $scrubName_go(_s_0, "");
}
function $nameOr(_default_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _default_0;
  } else {
    return _name_0;
  }
}
function $nameOr_if(_default_0, _name_0) {
  return $nameOr(_default_0, _name_0, $String_is_empty(_name_0));
}
function $cleanName(_default_0, _name_0) {
  return $String_take($scrubName($nameOr_if(_default_0, _name_0)), $maxNameChars());
}
function $cleanTextFile(_name_0, _text_0) {
  return { $: "TextFile", name: $cleanName($defaultFileName(), _name_0), text: _text_0 };
}
function $allowedMime(_mime_0) {
  const _x_0 = $String_eq(_mime_0, "image/webp");
  const _x_1 = $String_eq(_mime_0, "image/gif");
  const _x_2 = $String_eq(_mime_0, "image/jpg");
  const _x_3 = _x_0 || _x_1;
  const _x_4 = $String_eq(_mime_0, "image/jpeg");
  const _x_5 = _x_2 || _x_3;
  const _x_6 = $String_eq(_mime_0, "image/png");
  const _x_7 = _x_4 || _x_5;
  return _x_6 || _x_7;
}
function $canonMime_if(_mime_0, _jpg_0) {
  if (_jpg_0) {
    return "image/jpeg";
  } else {
    return _mime_0;
  }
}
function $canonMime(_mime_0) {
  return $canonMime_if(_mime_0, $String_eq(_mime_0, "image/jpg"));
}
function $partImage_dataUrl(_mime_0, _mimeEmpty_0, _data_0) {
  if (_mimeEmpty_0) {
    const _x_0 = $defaultImageMime();
    const _x_1 = ";base64," + _data_0;
    const _x_2 = _x_0 + _x_1;
    return "data:" + _x_2;
  } else {
    const _x_3 = ";base64," + _data_0;
    const _x_4 = _mime_0 + _x_3;
    return "data:" + _x_4;
  }
}
function $partImage_mime(_mime_0, _data_0) {
  return $partImage_dataUrl(_mime_0, $String_is_empty(_mime_0), _data_0);
}
function $partImage_data(_mime_0, _data_0, _dataEmpty_0) {
  if (_dataEmpty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", value: $partImage_mime(_mime_0, _data_0) };
  }
}
function $partImage_src(_url_0, _mime_0, _data_0, _urlEmpty_0, _dataEmpty_0) {
  if (!_urlEmpty_0) {
    return { $: "Some", value: _url_0 };
  } else {
    return $partImage_data(_mime_0, _data_0, _dataEmpty_0);
  }
}
function $partImage(_kind_0, _url_0, _mime_0, _data_0, _isImage_0, _urlEmpty_0, _dataEmpty_0) {
  if (_isImage_0) {
    return $partImage_src(_url_0, _mime_0, _data_0, _urlEmpty_0, _dataEmpty_0);
  } else {
    return { $: "None" };
  }
}
function $partVerdict_src(_pic_0) {
  if (_pic_0.$ === "Some") {
    const _src_0 = _pic_0["value"];
    return { $: "PartVerdict.Picture", src: _src_0 };
  } else {
    return { $: "PartVerdict.Ignore" };
  }
}
function $partVerdict_go(_src_0, _isText_0, _text_0) {
  if (_isText_0) {
    return { $: "PartVerdict.Text", text: _text_0 };
  } else {
    return $partVerdict_src(_src_0);
  }
}
function $partVerdict(_p_0) {
  const _kind_0 = _p_0["kind"];
  const _text_0 = _p_0["text"];
  const _data_0 = _p_0["data"];
  const _url_0 = _p_0["url"];
  const _mimeType_0 = _p_0["mimeType"];
  return $partVerdict_go($partImage(_kind_0, _url_0, _mimeType_0, _data_0, $String_eq(_kind_0, "image"), $String_is_empty(_url_0), $String_is_empty(_data_0)), $String_eq(_kind_0, "text"), _text_0);
}
function $partVerdicts(_parts_0) {
  if (_parts_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _parts_0["head"];
    const _t_0 = _parts_0["tail"];
    return { $: "Con", head: $partVerdict(_h_0), tail: $partVerdicts(_t_0) };
  }
}
function $scanParts($0, $1, $2) {
  for (;; ) {
    {
      const _parts_0 = $0;
      const _texts_0 = $1;
      const _images_0 = $2;
      if (_parts_0.$ === "Nil") {
        return { $: "Content", text: $String_join(_texts_0, `
`), images: _images_0 };
      } else {
        const _t_0 = _parts_0["head"];
        if (_t_0.$ === "PartVerdict.Text") {
          const _text_0 = _t_0["text"];
          const _t_1 = _parts_0["tail"];
          $0 = _t_1;
          $1 = $List_append(_texts_0, { $: "Con", head: _text_0, tail: { $: "Nil" } });
          $2 = _images_0;
          continue;
        } else if (_t_0.$ === "PartVerdict.Picture") {
          const _src_0 = _t_0["src"];
          const _t_2 = _parts_0["tail"];
          $0 = _t_2;
          $1 = _texts_0;
          $2 = $List_append(_images_0, { $: "Con", head: _src_0, tail: { $: "Nil" } });
          continue;
        } else {
          const _t_3 = _parts_0["tail"];
          $0 = _t_3;
          $1 = _texts_0;
          $2 = _images_0;
          continue;
        }
      }
    }
  }
}
function $contentParts(_isString_0, _text_0, _parts_0) {
  if (_isString_0) {
    return { $: "Content", text: _text_0, images: { $: "Nil" } };
  } else {
    return $scanParts($partVerdicts(_parts_0), { $: "Nil" }, { $: "Nil" });
  }
}
function $contentText(_c_0) {
  const _text_0 = _c_0["text"];
  return _text_0;
}
function $contentImages(_c_0) {
  const _images_0 = _c_0["images"];
  return _images_0;
}
function $imageVerdict_mime(_mimeOk_0, _dataUrl_0, _name_0) {
  if (!_mimeOk_0) {
    return { $: "ImageVerdict.Reject", reason: { $: "AttachError.BadType" } };
  } else {
    return { $: "ImageVerdict.Keep", attachment: { $: "Attachment", dataUrl: _dataUrl_0, name: $cleanName($defaultImageName(), _name_0) } };
  }
}
function $imageVerdict_valid(_valid_0, _mimeOk_0, _dataUrl_0, _name_0) {
  if (!_valid_0) {
    return { $: "ImageVerdict.Reject", reason: { $: "AttachError.BadType" } };
  } else {
    return $imageVerdict_mime(_mimeOk_0, _dataUrl_0, _name_0);
  }
}
function $imageVerdict_over(_overRaw_0, _valid_0, _mimeOk_0, _dataUrl_0, _name_0) {
  if (_overRaw_0) {
    return { $: "ImageVerdict.Reject", reason: { $: "AttachError.ImageTooLarge" } };
  } else {
    return $imageVerdict_valid(_valid_0, _mimeOk_0, _dataUrl_0, _name_0);
  }
}
function $imageVerdict(_item_0) {
  const _dataUrl_0 = _item_0["dataUrl"];
  const _mime_0 = _item_0["mime"];
  const _name_0 = _item_0["name"];
  const _valid_0 = _item_0["valid"];
  const _overRaw_0 = _item_0["overRaw"];
  return $imageVerdict_over(_overRaw_0, _valid_0, $allowedMime(_mime_0), _dataUrl_0, _name_0);
}
function $fileVerdict_empty(_empty_0, _file_0) {
  if (_empty_0) {
    return { $: "FileVerdict.Drop" };
  } else {
    return { $: "FileVerdict.Keep", file: _file_0 };
  }
}
function $fileVerdict_over(_over_0, _empty_0, _name_0, _text_0) {
  if (_over_0) {
    return { $: "FileVerdict.Reject", reason: { $: "AttachError.FileTooLarge" } };
  } else {
    return $fileVerdict_empty(_empty_0, $cleanTextFile(_name_0, _text_0));
  }
}
function $fileVerdict(_item_0) {
  const _name_0 = _item_0["name"];
  const _text_0 = _item_0["text"];
  const _over_0 = _item_0["over"];
  return $fileVerdict_over(_over_0, $String_is_empty(_text_0), _name_0, _text_0);
}
function $imageVerdicts(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return { $: "Con", head: $imageVerdict(_h_0), tail: $imageVerdicts(_t_0) };
  }
}
function $fileVerdicts(_files_0) {
  if (_files_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _files_0["head"];
    const _t_0 = _files_0["tail"];
    return { $: "Con", head: $fileVerdict(_h_0), tail: $fileVerdicts(_t_0) };
  }
}
function $collectImages($0, $1) {
  for (;; ) {
    {
      const _items_0 = $0;
      const _acc_0 = $1;
      if (_items_0.$ === "Nil") {
        return { $: "DraftImages", images: _acc_0, reason: { $: "None" } };
      } else {
        const _t_0 = _items_0["head"];
        if (_t_0.$ === "ImageVerdict.Keep") {
          const _attachment_0 = _t_0["attachment"];
          const _t_1 = _items_0["tail"];
          $0 = _t_1;
          $1 = $List_append(_acc_0, { $: "Con", head: _attachment_0, tail: { $: "Nil" } });
          continue;
        } else {
          const _reason_0 = _t_0["reason"];
          return { $: "DraftImages", images: _acc_0, reason: { $: "Some", value: _reason_0 } };
        }
      }
    }
  }
}
function $collectFiles($0, $1) {
  for (;; ) {
    {
      const _files_0 = $0;
      const _acc_0 = $1;
      if (_files_0.$ === "Nil") {
        return { $: "DraftFiles", files: _acc_0, reason: { $: "None" } };
      } else {
        const _t_0 = _files_0["head"];
        if (_t_0.$ === "FileVerdict.Keep") {
          const _file_0 = _t_0["file"];
          const _t_1 = _files_0["tail"];
          $0 = _t_1;
          $1 = $List_append(_acc_0, { $: "Con", head: _file_0, tail: { $: "Nil" } });
          continue;
        } else if (_t_0.$ === "FileVerdict.Drop") {
          const _t_2 = _files_0["tail"];
          $0 = _t_2;
          $1 = _acc_0;
          continue;
        } else {
          const _reason_0 = _t_0["reason"];
          return { $: "DraftFiles", files: _acc_0, reason: { $: "Some", value: _reason_0 } };
        }
      }
    }
  }
}
function $finishDraftFiles(_images_0, _files_0) {
  const _files_1 = _files_0["files"];
  const _t_0 = _files_0["reason"];
  if (_t_0.$ === "Some") {
    const _r_0 = _t_0["value"];
    return { $: "AttachResult.Bad", reason: _r_0 };
  } else {
    return { $: "AttachResult.Ok", images: _images_0, files: _files_1 };
  }
}
function $finishDraft(_imgs_0, _files_0) {
  const _images_0 = _imgs_0["images"];
  const _t_0 = _imgs_0["reason"];
  if (_t_0.$ === "Some") {
    const _r_0 = _t_0["value"];
    return { $: "AttachResult.Bad", reason: _r_0 };
  } else {
    return $finishDraftFiles(_images_0, $collectFiles($fileVerdicts($List_take(_files_0, $maxFiles())), { $: "Nil" }));
  }
}
function $normalizeAttachments(_images_0, _files_0) {
  return $finishDraft($collectImages($imageVerdicts($List_take(_images_0, $maxImages())), { $: "Nil" }), _files_0);
}
function $attachImages(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    const _images_0 = _r_0["images"];
    return _images_0;
  } else {
    return { $: "Nil" };
  }
}
function $attachFiles(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    const _files_0 = _r_0["files"];
    return _files_0;
  } else {
    return { $: "Nil" };
  }
}
function $attachReason(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    return { $: "None" };
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Some", value: _reason_0 };
  }
}
function $sendVerdict_total(_overTotal_0, _mime_0) {
  if (_overTotal_0) {
    return { $: "SendVerdict.Reject", reason: { $: "AttachError.TotalTooLarge" } };
  } else {
    return { $: "SendVerdict.Keep", mime: $canonMime(_mime_0) };
  }
}
function $sendVerdict_send(_overSend_0, _overTotal_0, _mime_0) {
  if (_overSend_0) {
    return { $: "SendVerdict.Reject", reason: { $: "AttachError.ReducedTooLarge" } };
  } else {
    return $sendVerdict_total(_overTotal_0, _mime_0);
  }
}
function $sendVerdict_raw(_overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (_overRaw_0) {
    return { $: "SendVerdict.Reject", reason: { $: "AttachError.ImageTooLarge" } };
  } else {
    return $sendVerdict_send(_overSend_0, _overTotal_0, _mime_0);
  }
}
function $sendVerdict_mime(_mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (!_mimeOk_0) {
    return { $: "SendVerdict.Reject", reason: { $: "AttachError.BadType" } };
  } else {
    return $sendVerdict_raw(_overRaw_0, _overSend_0, _overTotal_0, _mime_0);
  }
}
function $sendVerdict_valid(_valid_0, _mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (!_valid_0) {
    return { $: "SendVerdict.Reject", reason: { $: "AttachError.BadType" } };
  } else {
    return $sendVerdict_mime(_mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0);
  }
}
function $sendVerdict(_item_0) {
  const _mime_0 = _item_0["mime"];
  const _valid_0 = _item_0["valid"];
  const _overRaw_0 = _item_0["overRaw"];
  const _overSend_0 = _item_0["overSend"];
  const _overTotal_0 = _item_0["overTotal"];
  return $sendVerdict_valid(_valid_0, $allowedMime(_mime_0), _overRaw_0, _overSend_0, _overTotal_0, _mime_0);
}
function $sendVerdicts(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return { $: "Con", head: $sendVerdict(_h_0), tail: $sendVerdicts(_t_0) };
  }
}
function $collectMimes($0, $1) {
  for (;; ) {
    {
      const _items_0 = $0;
      const _acc_0 = $1;
      if (_items_0.$ === "Nil") {
        return { $: "SendResult.Ok", mimes: _acc_0 };
      } else {
        const _t_0 = _items_0["head"];
        if (_t_0.$ === "SendVerdict.Keep") {
          const _mime_0 = _t_0["mime"];
          const _t_1 = _items_0["tail"];
          $0 = _t_1;
          $1 = $List_append(_acc_0, { $: "Con", head: _mime_0, tail: { $: "Nil" } });
          continue;
        } else {
          const _reason_0 = _t_0["reason"];
          return { $: "SendResult.Bad", reason: _reason_0 };
        }
      }
    }
  }
}
function $promptImages(_items_0) {
  return $collectMimes($sendVerdicts($List_take(_items_0, $maxImages())), { $: "Nil" });
}
function $sentMimes(_r_0) {
  if (_r_0.$ === "SendResult.Ok") {
    const _mimes_0 = _r_0["mimes"];
    return _mimes_0;
  } else {
    return { $: "Nil" };
  }
}
function $Char_to_u32(_c_0) {
  return char_code(_c_0);
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_take(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    if (_n_0 === 0) {
      return "";
    } else {
      const _p_0 = _n_0 - 1;
      return _h_0 + $String_take(_t_0, _p_0);
    }
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $List_append(_t_0, _ys_0) };
  }
}
function $List_take(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $List_take(_t_0, _p_0) };
    }
  }
}
function $String_reverse_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = _h_0 + _acc_0;
        continue;
      }
    }
  }
}
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String_order(_a_0, _b_0) {
  return $String_order_go(_a_0, _b_0, { $: "EQ" });
}
function $String_join_go(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $String_order_go($0, $1, $2) {
  for (;; ) {
    {
      const _a_0 = $0;
      const _b_0 = $1;
      const _c_0 = $2;
      if (_a_0 === "") {
        if (_b_0 !== "") {
          if (_c_0.$ === "EQ") {
            return { $: "LT" };
          } else {
            return _c_0;
          }
        } else {
          return _c_0;
        }
      } else {
        const _t_1 = _a_0.slice(0, char_len(_a_0));
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            const _x_0 = char_code(_t_1);
            const _x_1 = char_code(_t_3);
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _x_1);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
var attachments_default = {
  maxImages: run_lib(() => run_loop($maxImages()), 0),
  maxFiles: run_lib(() => run_loop($maxFiles()), 0),
  maxNameChars: run_lib(() => run_loop($maxNameChars()), 0),
  maxDraftChars: run_lib(() => run_loop($maxDraftChars()), 0),
  maxTextChars: run_lib(() => run_loop($maxTextChars()), 0),
  maxRawBytes: run_lib(() => run_loop($maxRawBytes()), 0),
  maxSendBytes: run_lib(() => run_loop($maxSendBytes()), 0),
  maxTotalBytes: run_lib(() => run_loop($maxTotalBytes()), 0),
  defaultImageName: run_lib(() => str_out(run_loop($defaultImageName())), 0),
  defaultFileName: run_lib(() => str_out(run_loop($defaultFileName())), 0),
  defaultImageMime: run_lib(() => str_out(run_loop($defaultImageMime())), 0),
  "scrubChar.go": run_lib((a0, a1) => str_out(run_loop($scrubChar_go(str_in(a0), a1))), 2),
  scrubChar: run_lib((a0) => str_out(run_loop($scrubChar(str_in(a0)))), 1),
  "scrubName.go": run_lib((a0, a1) => str_out(run_loop($scrubName_go(str_in(a0), str_in(a1)))), 2),
  scrubName: run_lib((a0) => str_out(run_loop($scrubName(str_in(a0)))), 1),
  nameOr: run_lib((a0, a1, a2) => str_out(run_loop($nameOr(str_in(a0), str_in(a1), a2))), 3),
  "nameOr.if": run_lib((a0, a1) => str_out(run_loop($nameOr_if(str_in(a0), str_in(a1)))), 2),
  cleanName: run_lib((a0, a1) => str_out(run_loop($cleanName(str_in(a0), str_in(a1)))), 2),
  cleanTextFile: run_lib((a0, a1) => run_loop($cleanTextFile(str_in(a0), str_in(a1))), 2),
  allowedMime: run_lib((a0) => run_loop($allowedMime(str_in(a0))), 1),
  "canonMime.if": run_lib((a0, a1) => str_out(run_loop($canonMime_if(str_in(a0), a1))), 2),
  canonMime: run_lib((a0) => str_out(run_loop($canonMime(str_in(a0)))), 1),
  "partImage.dataUrl": run_lib((a0, a1, a2) => str_out(run_loop($partImage_dataUrl(str_in(a0), a1, str_in(a2)))), 3),
  "partImage.mime": run_lib((a0, a1) => str_out(run_loop($partImage_mime(str_in(a0), str_in(a1)))), 2),
  "partImage.data": run_lib((a0, a1, a2) => run_loop($partImage_data(str_in(a0), str_in(a1), a2)), 3),
  "partImage.src": run_lib((a0, a1, a2, a3, a4) => run_loop($partImage_src(str_in(a0), str_in(a1), str_in(a2), a3, a4)), 5),
  partImage: run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($partImage(str_in(a0), str_in(a1), str_in(a2), str_in(a3), a4, a5, a6)), 7),
  "partVerdict.src": run_lib((a0) => run_loop($partVerdict_src(a0)), 1),
  "partVerdict.go": run_lib((a0, a1, a2) => run_loop($partVerdict_go(a0, a1, str_in(a2))), 3),
  partVerdict: run_lib((a0) => run_loop($partVerdict(a0)), 1),
  partVerdicts: run_lib((a0) => run_loop($partVerdicts(a0)), 1),
  scanParts: run_lib((a0, a1, a2) => run_loop($scanParts(a0, a1, a2)), 3),
  contentParts: run_lib((a0, a1, a2) => run_loop($contentParts(a0, str_in(a1), a2)), 3),
  contentText: run_lib((a0) => str_out(run_loop($contentText(a0))), 1),
  contentImages: run_lib((a0) => run_loop($contentImages(a0)), 1),
  "imageVerdict.mime": run_lib((a0, a1, a2) => run_loop($imageVerdict_mime(a0, str_in(a1), str_in(a2))), 3),
  "imageVerdict.valid": run_lib((a0, a1, a2, a3) => run_loop($imageVerdict_valid(a0, a1, str_in(a2), str_in(a3))), 4),
  "imageVerdict.over": run_lib((a0, a1, a2, a3, a4) => run_loop($imageVerdict_over(a0, a1, a2, str_in(a3), str_in(a4))), 5),
  imageVerdict: run_lib((a0) => run_loop($imageVerdict(a0)), 1),
  "fileVerdict.empty": run_lib((a0, a1) => run_loop($fileVerdict_empty(a0, a1)), 2),
  "fileVerdict.over": run_lib((a0, a1, a2, a3) => run_loop($fileVerdict_over(a0, a1, str_in(a2), str_in(a3))), 4),
  fileVerdict: run_lib((a0) => run_loop($fileVerdict(a0)), 1),
  imageVerdicts: run_lib((a0) => run_loop($imageVerdicts(a0)), 1),
  fileVerdicts: run_lib((a0) => run_loop($fileVerdicts(a0)), 1),
  collectImages: run_lib((a0, a1) => run_loop($collectImages(a0, a1)), 2),
  collectFiles: run_lib((a0, a1) => run_loop($collectFiles(a0, a1)), 2),
  finishDraftFiles: run_lib((a0, a1) => run_loop($finishDraftFiles(a0, a1)), 2),
  finishDraft: run_lib((a0, a1) => run_loop($finishDraft(a0, a1)), 2),
  normalizeAttachments: run_lib((a0, a1) => run_loop($normalizeAttachments(a0, a1)), 2),
  attachImages: run_lib((a0) => run_loop($attachImages(a0)), 1),
  attachFiles: run_lib((a0) => run_loop($attachFiles(a0)), 1),
  attachReason: run_lib((a0) => run_loop($attachReason(a0)), 1),
  "sendVerdict.total": run_lib((a0, a1) => run_loop($sendVerdict_total(a0, str_in(a1))), 2),
  "sendVerdict.send": run_lib((a0, a1, a2) => run_loop($sendVerdict_send(a0, a1, str_in(a2))), 3),
  "sendVerdict.raw": run_lib((a0, a1, a2, a3) => run_loop($sendVerdict_raw(a0, a1, a2, str_in(a3))), 4),
  "sendVerdict.mime": run_lib((a0, a1, a2, a3, a4) => run_loop($sendVerdict_mime(a0, a1, a2, a3, str_in(a4))), 5),
  "sendVerdict.valid": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($sendVerdict_valid(a0, a1, a2, a3, a4, str_in(a5))), 6),
  sendVerdict: run_lib((a0) => run_loop($sendVerdict(a0)), 1),
  sendVerdicts: run_lib((a0) => run_loop($sendVerdicts(a0)), 1),
  collectMimes: run_lib((a0, a1) => run_loop($collectMimes(a0, a1)), 2),
  promptImages: run_lib((a0) => run_loop($promptImages(a0)), 1),
  sentMimes: run_lib((a0) => run_loop($sentMimes(a0)), 1)
};
export {
  attachments_default as default
};

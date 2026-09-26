// GERADO de core/attachments.bend por `bun core/build.mjs` — não editar à mão.
// core/attachments.bend
function u32_to_word(x) {
  let w = { $: "WNil" };
  for (let i = 31;i >= 0; i--) {
    w = { $: "WCon", head: (x >>> i & 1) === 1, tail: w };
  }
  return w;
}
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function char_new(code) {
  if (code > 1114111 || code >= 55296 && code <= 57343) {
    throw "bend: " + code + " is not a Unicode scalar value";
  }
  return String.fromCodePoint(code);
}
function run_jump(f, x) {
  return { $: "$JMP", f, x };
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(...r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
function $maxImages$() {
  return 4n;
}
function $maxFiles$() {
  return 4n;
}
function $maxNameChars$() {
  return 120n;
}
function $maxDraftChars$() {
  const _x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxTextChars$() {
  return 80000;
}
function $maxRawBytes$() {
  const _x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxSendBytes$() {
  const _x_0 = Math.imul(8, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $maxTotalBytes$() {
  const _x_0 = Math.imul(28, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $defaultImageName$() {
  return "imagem";
}
function $defaultFileName$() {
  return "anexo";
}
function $defaultImageMime$() {
  return "image/png";
}
function $scrubChar$go$(_c_0, _code_0) {
  if (_code_0 == 10) {
    return " ";
  } else if ((_code_0 & 1) == 0) {
    const _10_0 = u32_to_word(_code_0)["tail"]["head"];
    const _11_0 = u32_to_word(_code_0)["tail"]["tail"];
    return _c_0;
  } else if (_code_0 == 13) {
    return " ";
  } else {
    const _72_0 = u32_to_word(_code_0)["tail"]["head"];
    const _73_0 = u32_to_word(_code_0)["tail"]["tail"];
    return _c_0;
  }
}
function $scrubChar$(_c_0) {
  return run_jump($scrubChar$go$, [_c_0, run_loop($Char$to_u32$(_c_0))]);
}
function $scrubName$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return run_jump($String$reverse$, [_acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($scrubName$go$, [_t_0, run_loop($scrubChar$(_h_0)) + _acc_0]);
  }
}
function $scrubName$(_s_0) {
  return run_jump($scrubName$go$, [_s_0, ""]);
}
function $nameOr$(_default_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _default_0;
  } else {
    return _name_0;
  }
}
function $nameOr$if$(_default_0, _name_0) {
  return run_jump($nameOr$, [_default_0, _name_0, run_loop($String$is_empty$(_name_0))]);
}
function $cleanName$(_default_0, _name_0) {
  return run_jump($String$take$, [run_loop($scrubName$(run_loop($nameOr$if$(_default_0, _name_0)))), run_loop($maxNameChars$())]);
}
function $cleanTextFile$(_name_0, _text_0) {
  return { $: "TextFile", ["name"]: run_loop($cleanName$(run_loop($defaultFileName$()), _name_0)), ["text"]: _text_0 };
}
function $allowedMime$(_mime_0) {
  const _x_0 = run_loop($String$eq$(_mime_0, "image/webp"));
  const _x_1 = run_loop($String$eq$(_mime_0, "image/gif"));
  const _x_2 = run_loop($String$eq$(_mime_0, "image/jpg"));
  const _x_3 = _x_0 || _x_1;
  const _x_4 = run_loop($String$eq$(_mime_0, "image/jpeg"));
  const _x_5 = _x_2 || _x_3;
  const _x_6 = run_loop($String$eq$(_mime_0, "image/png"));
  const _x_7 = _x_4 || _x_5;
  return _x_6 || _x_7;
}
function $canonMime$if$(_mime_0, _jpg_0) {
  if (_jpg_0) {
    return "image/jpeg";
  } else {
    return _mime_0;
  }
}
function $canonMime$(_mime_0) {
  return run_jump($canonMime$if$, [_mime_0, run_loop($String$eq$(_mime_0, "image/jpg"))]);
}
function $partImage$dataUrl$(_mime_0, _mimeEmpty_0, _data_0) {
  if (_mimeEmpty_0) {
    const _x_0 = run_loop($defaultImageMime$());
    const _x_1 = ";base64," + _data_0;
    const _x_2 = _x_0 + _x_1;
    return "data:" + _x_2;
  } else {
    const _x_3 = ";base64," + _data_0;
    const _x_4 = _mime_0 + _x_3;
    return "data:" + _x_4;
  }
}
function $partImage$mime$(_mime_0, _data_0) {
  return run_jump($partImage$dataUrl$, [_mime_0, run_loop($String$is_empty$(_mime_0)), _data_0]);
}
function $partImage$data$(_mime_0, _data_0, _dataEmpty_0) {
  if (_dataEmpty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", ["value"]: run_loop($partImage$mime$(_mime_0, _data_0)) };
  }
}
function $partImage$src$(_url_0, _mime_0, _data_0, _urlEmpty_0, _dataEmpty_0) {
  if (!_urlEmpty_0) {
    return { $: "Some", ["value"]: _url_0 };
  } else {
    return run_jump($partImage$data$, [_mime_0, _data_0, _dataEmpty_0]);
  }
}
function $partImage$(_kind_0, _url_0, _mime_0, _data_0, _isImage_0, _urlEmpty_0, _dataEmpty_0) {
  if (_isImage_0) {
    return run_jump($partImage$src$, [_url_0, _mime_0, _data_0, _urlEmpty_0, _dataEmpty_0]);
  } else {
    return { $: "None" };
  }
}
function $partVerdict$src$(_pic_0) {
  if (_pic_0.$ === "Some") {
    const _src_0 = _pic_0["value"];
    return { $: "PartVerdict.Picture", ["src"]: _src_0 };
  } else {
    return { $: "PartVerdict.Ignore" };
  }
}
function $partVerdict$go$(_src_0, _isText_0, _text_0) {
  if (_isText_0) {
    return { $: "PartVerdict.Text", ["text"]: _text_0 };
  } else {
    return run_jump($partVerdict$src$, [_src_0]);
  }
}
function $partVerdict$(_p_0) {
  const _kind_0 = _p_0["kind"];
  const _text_0 = _p_0["text"];
  const _data_0 = _p_0["data"];
  const _url_0 = _p_0["url"];
  const _mimeType_0 = _p_0["mimeType"];
  return run_jump($partVerdict$go$, [run_loop($partImage$(_kind_0, _url_0, _mimeType_0, _data_0, run_loop($String$eq$(_kind_0, "image")), run_loop($String$is_empty$(_url_0)), run_loop($String$is_empty$(_data_0)))), run_loop($String$eq$(_kind_0, "text")), _text_0]);
}
function $partVerdicts$(_parts_0) {
  if (_parts_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _parts_0["head"];
    const _t_0 = _parts_0["tail"];
    return { $: "Con", ["head"]: run_loop($partVerdict$(_h_0)), ["tail"]: run_loop($partVerdicts$(_t_0)) };
  }
}
function $scanParts$(_parts_0, _texts_0, _images_0) {
  if (_parts_0.$ === "Nil") {
    return { $: "Content", ["text"]: run_loop($String$join$(_texts_0, `
`)), ["images"]: _images_0 };
  } else {
    const _t_0 = _parts_0["head"];
    if (_t_0.$ === "PartVerdict.Text") {
      const _text_0 = _t_0["text"];
      const _t_1 = _parts_0["tail"];
      return run_jump($scanParts$, [_t_1, run_loop($List$append$(_texts_0, { $: "Con", ["head"]: _text_0, ["tail"]: { $: "Nil" } })), _images_0]);
    } else if (_t_0.$ === "PartVerdict.Picture") {
      const _src_0 = _t_0["src"];
      const _t_2 = _parts_0["tail"];
      return run_jump($scanParts$, [_t_2, _texts_0, run_loop($List$append$(_images_0, { $: "Con", ["head"]: _src_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const _t_3 = _parts_0["tail"];
      return run_jump($scanParts$, [_t_3, _texts_0, _images_0]);
    }
  }
}
function $contentParts$(_isString_0, _text_0, _parts_0) {
  if (_isString_0) {
    return { $: "Content", ["text"]: _text_0, ["images"]: { $: "Nil" } };
  } else {
    return run_jump($scanParts$, [run_loop($partVerdicts$(_parts_0)), { $: "Nil" }, { $: "Nil" }]);
  }
}
function $contentText$(_c_0) {
  const _text_0 = _c_0["text"];
  const _images_0 = _c_0["images"];
  return _text_0;
}
function $contentImages$(_c_0) {
  const _text_0 = _c_0["text"];
  const _images_0 = _c_0["images"];
  return _images_0;
}
function $imageVerdict$mime$(_mimeOk_0, _dataUrl_0, _name_0) {
  if (!_mimeOk_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return { $: "ImageVerdict.Keep", ["attachment"]: { $: "Attachment", ["dataUrl"]: _dataUrl_0, ["name"]: run_loop($cleanName$(run_loop($defaultImageName$()), _name_0)) } };
  }
}
function $imageVerdict$valid$(_valid_0, _mimeOk_0, _dataUrl_0, _name_0) {
  if (!_valid_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($imageVerdict$mime$, [_mimeOk_0, _dataUrl_0, _name_0]);
  }
}
function $imageVerdict$over$(_overRaw_0, _valid_0, _mimeOk_0, _dataUrl_0, _name_0) {
  if (_overRaw_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.ImageTooLarge" } };
  } else {
    return run_jump($imageVerdict$valid$, [_valid_0, _mimeOk_0, _dataUrl_0, _name_0]);
  }
}
function $imageVerdict$(_item_0) {
  const _dataUrl_0 = _item_0["dataUrl"];
  const _mime_0 = _item_0["mime"];
  const _name_0 = _item_0["name"];
  const _valid_0 = _item_0["valid"];
  const _overRaw_0 = _item_0["overRaw"];
  return run_jump($imageVerdict$over$, [_overRaw_0, _valid_0, run_loop($allowedMime$(_mime_0)), _dataUrl_0, _name_0]);
}
function $fileVerdict$empty$(_empty_0, _file_0) {
  if (_empty_0) {
    return { $: "FileVerdict.Drop" };
  } else {
    return { $: "FileVerdict.Keep", ["file"]: _file_0 };
  }
}
function $fileVerdict$over$(_over_0, _empty_0, _name_0, _text_0) {
  if (_over_0) {
    return { $: "FileVerdict.Reject", ["reason"]: { $: "AttachError.FileTooLarge" } };
  } else {
    return run_jump($fileVerdict$empty$, [_empty_0, run_loop($cleanTextFile$(_name_0, _text_0))]);
  }
}
function $fileVerdict$(_item_0) {
  const _name_0 = _item_0["name"];
  const _text_0 = _item_0["text"];
  const _over_0 = _item_0["over"];
  return run_jump($fileVerdict$over$, [_over_0, run_loop($String$is_empty$(_text_0)), _name_0, _text_0]);
}
function $imageVerdicts$(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return { $: "Con", ["head"]: run_loop($imageVerdict$(_h_0)), ["tail"]: run_loop($imageVerdicts$(_t_0)) };
  }
}
function $fileVerdicts$(_files_0) {
  if (_files_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _files_0["head"];
    const _t_0 = _files_0["tail"];
    return { $: "Con", ["head"]: run_loop($fileVerdict$(_h_0)), ["tail"]: run_loop($fileVerdicts$(_t_0)) };
  }
}
function $collectImages$(_items_0, _acc_0) {
  if (_items_0.$ === "Nil") {
    return { $: "DraftImages", ["images"]: _acc_0, ["reason"]: { $: "None" } };
  } else {
    const _t_0 = _items_0["head"];
    if (_t_0.$ === "ImageVerdict.Keep") {
      const _attachment_0 = _t_0["attachment"];
      const _t_1 = _items_0["tail"];
      return run_jump($collectImages$, [_t_1, run_loop($List$append$(_acc_0, { $: "Con", ["head"]: _attachment_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const _reason_0 = _t_0["reason"];
      const _t_2 = _items_0["tail"];
      return { $: "DraftImages", ["images"]: _acc_0, ["reason"]: { $: "Some", ["value"]: _reason_0 } };
    }
  }
}
function $collectFiles$(_files_0, _acc_0) {
  if (_files_0.$ === "Nil") {
    return { $: "DraftFiles", ["files"]: _acc_0, ["reason"]: { $: "None" } };
  } else {
    const _t_0 = _files_0["head"];
    if (_t_0.$ === "FileVerdict.Keep") {
      const _file_0 = _t_0["file"];
      const _t_1 = _files_0["tail"];
      return run_jump($collectFiles$, [_t_1, run_loop($List$append$(_acc_0, { $: "Con", ["head"]: _file_0, ["tail"]: { $: "Nil" } }))]);
    } else if (_t_0.$ === "FileVerdict.Drop") {
      const _t_2 = _files_0["tail"];
      return run_jump($collectFiles$, [_t_2, _acc_0]);
    } else {
      const _reason_0 = _t_0["reason"];
      const _t_3 = _files_0["tail"];
      return { $: "DraftFiles", ["files"]: _acc_0, ["reason"]: { $: "Some", ["value"]: _reason_0 } };
    }
  }
}
function $finishDraftFiles$(_images_0, _files_0) {
  const _files_1 = _files_0["files"];
  const _t_0 = _files_0["reason"];
  if (_t_0.$ === "Some") {
    const _r_0 = _t_0["value"];
    return { $: "AttachResult.Bad", ["reason"]: _r_0 };
  } else {
    return { $: "AttachResult.Ok", ["images"]: _images_0, ["files"]: _files_1 };
  }
}
function $finishDraft$(_imgs_0, _files_0) {
  const _images_0 = _imgs_0["images"];
  const _t_0 = _imgs_0["reason"];
  if (_t_0.$ === "Some") {
    const _r_0 = _t_0["value"];
    return { $: "AttachResult.Bad", ["reason"]: _r_0 };
  } else {
    return run_jump($finishDraftFiles$, [_images_0, run_loop($collectFiles$(run_loop($fileVerdicts$(run_loop($List$take$(_files_0, run_loop($maxFiles$()))))), { $: "Nil" }))]);
  }
}
function $normalizeAttachments$(_images_0, _files_0) {
  return run_jump($finishDraft$, [run_loop($collectImages$(run_loop($imageVerdicts$(run_loop($List$take$(_images_0, run_loop($maxImages$()))))), { $: "Nil" })), _files_0]);
}
function $attachImages$(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    const _images_0 = _r_0["images"];
    const _files_0 = _r_0["files"];
    return _images_0;
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Nil" };
  }
}
function $attachFiles$(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    const _images_0 = _r_0["images"];
    const _files_0 = _r_0["files"];
    return _files_0;
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Nil" };
  }
}
function $attachReason$(_r_0) {
  if (_r_0.$ === "AttachResult.Ok") {
    const _images_0 = _r_0["images"];
    const _files_0 = _r_0["files"];
    return { $: "None" };
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Some", ["value"]: _reason_0 };
  }
}
function $sendVerdict$total$(_overTotal_0, _mime_0) {
  if (_overTotal_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.TotalTooLarge" } };
  } else {
    return { $: "SendVerdict.Keep", ["mime"]: run_loop($canonMime$(_mime_0)) };
  }
}
function $sendVerdict$send$(_overSend_0, _overTotal_0, _mime_0) {
  if (_overSend_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.ReducedTooLarge" } };
  } else {
    return run_jump($sendVerdict$total$, [_overTotal_0, _mime_0]);
  }
}
function $sendVerdict$raw$(_overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (_overRaw_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.ImageTooLarge" } };
  } else {
    return run_jump($sendVerdict$send$, [_overSend_0, _overTotal_0, _mime_0]);
  }
}
function $sendVerdict$mime$(_mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (!_mimeOk_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($sendVerdict$raw$, [_overRaw_0, _overSend_0, _overTotal_0, _mime_0]);
  }
}
function $sendVerdict$valid$(_valid_0, _mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0) {
  if (!_valid_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($sendVerdict$mime$, [_mimeOk_0, _overRaw_0, _overSend_0, _overTotal_0, _mime_0]);
  }
}
function $sendVerdict$(_item_0) {
  const _mime_0 = _item_0["mime"];
  const _valid_0 = _item_0["valid"];
  const _overRaw_0 = _item_0["overRaw"];
  const _overSend_0 = _item_0["overSend"];
  const _overTotal_0 = _item_0["overTotal"];
  return run_jump($sendVerdict$valid$, [_valid_0, run_loop($allowedMime$(_mime_0)), _overRaw_0, _overSend_0, _overTotal_0, _mime_0]);
}
function $sendVerdicts$(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return { $: "Con", ["head"]: run_loop($sendVerdict$(_h_0)), ["tail"]: run_loop($sendVerdicts$(_t_0)) };
  }
}
function $collectMimes$(_items_0, _acc_0) {
  if (_items_0.$ === "Nil") {
    return { $: "SendResult.Ok", ["mimes"]: _acc_0 };
  } else {
    const _t_0 = _items_0["head"];
    if (_t_0.$ === "SendVerdict.Keep") {
      const _mime_0 = _t_0["mime"];
      const _t_1 = _items_0["tail"];
      return run_jump($collectMimes$, [_t_1, run_loop($List$append$(_acc_0, { $: "Con", ["head"]: _mime_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const _reason_0 = _t_0["reason"];
      const _t_2 = _items_0["tail"];
      return { $: "SendResult.Bad", ["reason"]: _reason_0 };
    }
  }
}
function $promptImages$(_items_0) {
  return run_jump($collectMimes$, [run_loop($sendVerdicts$(run_loop($List$take$(_items_0, run_loop($maxImages$()))))), { $: "Nil" }]);
}
function $sentMimes$(_r_0) {
  if (_r_0.$ === "SendResult.Ok") {
    const _mimes_0 = _r_0["mimes"];
    return _mimes_0;
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Nil" };
  }
}
function $sentReason$(_r_0) {
  if (_r_0.$ === "SendResult.Ok") {
    const _mimes_0 = _r_0["mimes"];
    return { $: "None" };
  } else {
    const _reason_0 = _r_0["reason"];
    return { $: "Some", ["value"]: _reason_0 };
  }
}
function $Char$to_u32$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return _x_0;
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $String$is_empty$(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return false;
  }
}
function $String$take$(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return "";
    } else {
      const _p_0 = _n_0 - 1n;
      return _h_0 + run_loop($String$take$(_t_0, _p_0));
    }
  }
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
}
function $String$join$(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($String$join$go$, [_t_0, _h_0, _sep_0]);
  }
}
function $List$append$(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$append$(_t_0, _ys_0)) };
  }
}
function $List$take$(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1n;
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$take$(_t_0, _p_0)) };
    }
  }
}
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
function $String$eq$fin$(_r_0) {
  const _t_0 = _r_0["fst"];
  const _a2_0 = _t_0["fst"];
  const _b2_0 = _t_0["snd"];
  const _c_0 = _r_0["snd"];
  return run_jump($Cmp$is_eq$, [_c_0]);
}
function $String$cmp$(_a_0, _b_0) {
  if (_a_0 === "") {
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const _h_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: _h_0 + _t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const _h_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(0, 2) : _a_0[0];
    const _t_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(2) : _a_0.slice(1);
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h_1 + _t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const _h2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return run_jump($String$cmp$fin$, [_t_1, _t2_0, run_loop($Char$cmp$(_h_1, _h2_0))]);
    }
  }
}
function $String$join$go$(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = run_loop($String$join$go$(_t_0, _h2_0, _sep_0));
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Cmp$is_eq$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(_t1_0, _t2_0, _hc_0) {
  const _t_0 = _hc_0["fst"];
  const _h1b_0 = _t_0["fst"];
  const _h2b_0 = _t_0["snd"];
  const _t_1 = _hc_0["snd"];
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [_h1b_0, _h2b_0, run_loop($String$cmp$(_t1_0, _t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(_x_0), ["snd"]: char_new(_y_0) }, ["snd"]: cmp_new(_x_0, _y_0) };
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var attachments_default = {
  maxImages: run_lib($maxImages$, 0),
  maxFiles: run_lib($maxFiles$, 0),
  maxNameChars: run_lib($maxNameChars$, 0),
  maxDraftChars: run_lib($maxDraftChars$, 0),
  maxTextChars: run_lib($maxTextChars$, 0),
  maxRawBytes: run_lib($maxRawBytes$, 0),
  maxSendBytes: run_lib($maxSendBytes$, 0),
  maxTotalBytes: run_lib($maxTotalBytes$, 0),
  defaultImageName: run_lib($defaultImageName$, 0),
  defaultFileName: run_lib($defaultFileName$, 0),
  defaultImageMime: run_lib($defaultImageMime$, 0),
  "scrubChar.go": run_lib($scrubChar$go$, 2),
  scrubChar: run_lib($scrubChar$, 1),
  "scrubName.go": run_lib($scrubName$go$, 2),
  scrubName: run_lib($scrubName$, 1),
  nameOr: run_lib($nameOr$, 3),
  "nameOr.if": run_lib($nameOr$if$, 2),
  cleanName: run_lib($cleanName$, 2),
  cleanTextFile: run_lib($cleanTextFile$, 2),
  allowedMime: run_lib($allowedMime$, 1),
  "canonMime.if": run_lib($canonMime$if$, 2),
  canonMime: run_lib($canonMime$, 1),
  "partImage.dataUrl": run_lib($partImage$dataUrl$, 3),
  "partImage.mime": run_lib($partImage$mime$, 2),
  "partImage.data": run_lib($partImage$data$, 3),
  "partImage.src": run_lib($partImage$src$, 5),
  partImage: run_lib($partImage$, 7),
  "partVerdict.src": run_lib($partVerdict$src$, 1),
  "partVerdict.go": run_lib($partVerdict$go$, 3),
  partVerdict: run_lib($partVerdict$, 1),
  partVerdicts: run_lib($partVerdicts$, 1),
  scanParts: run_lib($scanParts$, 3),
  contentParts: run_lib($contentParts$, 3),
  contentText: run_lib($contentText$, 1),
  contentImages: run_lib($contentImages$, 1),
  "imageVerdict.mime": run_lib($imageVerdict$mime$, 3),
  "imageVerdict.valid": run_lib($imageVerdict$valid$, 4),
  "imageVerdict.over": run_lib($imageVerdict$over$, 5),
  imageVerdict: run_lib($imageVerdict$, 1),
  "fileVerdict.empty": run_lib($fileVerdict$empty$, 2),
  "fileVerdict.over": run_lib($fileVerdict$over$, 4),
  fileVerdict: run_lib($fileVerdict$, 1),
  imageVerdicts: run_lib($imageVerdicts$, 1),
  fileVerdicts: run_lib($fileVerdicts$, 1),
  collectImages: run_lib($collectImages$, 2),
  collectFiles: run_lib($collectFiles$, 2),
  finishDraftFiles: run_lib($finishDraftFiles$, 2),
  finishDraft: run_lib($finishDraft$, 2),
  normalizeAttachments: run_lib($normalizeAttachments$, 2),
  attachImages: run_lib($attachImages$, 1),
  attachFiles: run_lib($attachFiles$, 1),
  attachReason: run_lib($attachReason$, 1),
  "sendVerdict.total": run_lib($sendVerdict$total$, 2),
  "sendVerdict.send": run_lib($sendVerdict$send$, 3),
  "sendVerdict.raw": run_lib($sendVerdict$raw$, 4),
  "sendVerdict.mime": run_lib($sendVerdict$mime$, 5),
  "sendVerdict.valid": run_lib($sendVerdict$valid$, 6),
  sendVerdict: run_lib($sendVerdict$, 1),
  sendVerdicts: run_lib($sendVerdicts$, 1),
  collectMimes: run_lib($collectMimes$, 2),
  promptImages: run_lib($promptImages$, 1),
  sentMimes: run_lib($sentMimes$, 1),
  sentReason: run_lib($sentReason$, 1)
};
export {
  attachments_default as default
};

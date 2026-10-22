// GERADO de core/phonedrop.bend por `bun core/build.mjs` — não editar à mão.
// core/phonedrop.bend
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
function $running(_f_0) {
  if (_f_0.$ === "PhoneOff") {
    return false;
  } else if (_f_0.$ === "PhoneWaiting") {
    return true;
  } else if (_f_0.$ === "PhoneReceived") {
    return true;
  } else if (_f_0.$ === "PhoneStopped") {
    return false;
  } else if (_f_0.$ === "PhoneExpired") {
    return false;
  } else {
    return false;
  }
}
function $received(_f_0) {
  if (_f_0.$ === "PhoneOff") {
    return 0;
  } else if (_f_0.$ === "PhoneWaiting") {
    return 0;
  } else if (_f_0.$ === "PhoneReceived") {
    const _count_0 = _f_0["count"];
    return _count_0;
  } else if (_f_0.$ === "PhoneStopped") {
    const _count_1 = _f_0["count"];
    return _count_1;
  } else if (_f_0.$ === "PhoneExpired") {
    const _count_2 = _f_0["count"];
    return _count_2;
  } else {
    return 0;
  }
}
function $onPhoto(_f_0) {
  if (_f_0.$ === "PhoneOff") {
    return { $: "PhoneOff" };
  } else if (_f_0.$ === "PhoneWaiting") {
    return { $: "PhoneReceived", count: 1 };
  } else if (_f_0.$ === "PhoneReceived") {
    const _count_0 = _f_0["count"];
    return { $: "PhoneReceived", count: _count_0 + 1 >>> 0 };
  } else if (_f_0.$ === "PhoneStopped") {
    const _count_1 = _f_0["count"];
    return { $: "PhoneStopped", count: _count_1 };
  } else if (_f_0.$ === "PhoneExpired") {
    const _count_2 = _f_0["count"];
    return { $: "PhoneExpired", count: _count_2 };
  } else {
    return { $: "PhoneNetError" };
  }
}
function $closeAs(_f_0, _expired_0) {
  if (_expired_0) {
    return { $: "PhoneExpired", count: $received(_f_0) };
  } else {
    return { $: "PhoneStopped", count: $received(_f_0) };
  }
}
function $onClose_when(_up_0, _f_0, _expired_0) {
  if (_up_0) {
    return $closeAs(_f_0, _expired_0);
  } else {
    return _f_0;
  }
}
function $onClose(_f_0, _expired_0) {
  return $onClose_when($running(_f_0), _f_0, _expired_0);
}
function $step(_f_0, _e_0) {
  if (_e_0.$ === "EvStart") {
    return { $: "PhoneWaiting" };
  } else if (_e_0.$ === "EvPhoto") {
    return $onPhoto(_f_0);
  } else if (_e_0.$ === "EvStop") {
    return $onClose(_f_0, false);
  } else if (_e_0.$ === "EvIdle") {
    return $onClose(_f_0, true);
  } else {
    return { $: "PhoneNetError" };
  }
}
function $maxFileBytes() {
  return 15728640;
}
function $maxSessionPhotos() {
  return 12;
}
function $maxSessionBytes() {
  return 104857600;
}
function $idleMs() {
  return 600000;
}
function $routeDoor(_r_0) {
  if (_r_0.$ === "PageRoute") {
    return { $: "DoorPage" };
  } else if (_r_0.$ === "UploadRoute") {
    return { $: "DoorUpload" };
  } else {
    return { $: "DoorClosed" };
  }
}
function $tokenDoor(_token_0, _r_0) {
  if (_token_0) {
    return $routeDoor(_r_0);
  } else {
    return { $: "DoorClosed" };
  }
}
function $door(_up_0, _token_0, _r_0) {
  if (_up_0) {
    return $tokenDoor(_token_0, _r_0);
  } else {
    return { $: "DoorClosed" };
  }
}
function $isImage(_k_0) {
  if (_k_0.$ === "KindJpeg") {
    return true;
  } else if (_k_0.$ === "KindPng") {
    return true;
  } else if (_k_0.$ === "KindWebp") {
    return true;
  } else {
    return false;
  }
}
function $acceptUnless(_full_0) {
  if (_full_0) {
    return { $: "PhotoFull" };
  } else {
    return { $: "PhotoAccept" };
  }
}
function $sessionFull(_photos_0, _total_0, _bytes_0) {
  const _x_0 = $maxSessionPhotos();
  const _x_1 = $maxSessionBytes();
  const _x_2 = _x_1 - _total_0 >>> 0;
  const _x_3 = _photos_0 >= _x_0;
  const _x_4 = _bytes_0 > _x_2;
  return _x_3 || _x_4;
}
function $fitsFile_when(_big_0, _bytes_0, _photos_0, _total_0) {
  if (_big_0) {
    return { $: "PhotoTooLarge" };
  } else {
    return $acceptUnless($sessionFull(_photos_0, _total_0, _bytes_0));
  }
}
function $fitsFile(_bytes_0, _photos_0, _total_0) {
  const _x_0 = $maxFileBytes();
  return $fitsFile_when(_bytes_0 > _x_0, _bytes_0, _photos_0, _total_0);
}
function $imageVerdict_when(_ok_0, _bytes_0, _photos_0, _total_0) {
  if (_ok_0) {
    return $fitsFile(_bytes_0, _photos_0, _total_0);
  } else {
    return { $: "PhotoWrongType" };
  }
}
function $imageVerdict(_k_0, _bytes_0, _photos_0, _total_0) {
  return $imageVerdict_when($Bool_and($isImage(_k_0), $Bool_not(_bytes_0 === 0)), _bytes_0, _photos_0, _total_0);
}
function $photo(_up_0, _k_0, _bytes_0, _photos_0, _total_0) {
  if (_up_0) {
    return $imageVerdict(_k_0, _bytes_0, _photos_0, _total_0);
  } else {
    return { $: "PhotoGone" };
  }
}
function $verdictStatus(_v_0) {
  if (_v_0.$ === "PhotoAccept") {
    return 201;
  } else if (_v_0.$ === "PhotoGone") {
    return 404;
  } else if (_v_0.$ === "PhotoWrongType") {
    return 415;
  } else if (_v_0.$ === "PhotoTooLarge") {
    return 413;
  } else {
    return 413;
  }
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
var phonedrop_default = {
  running: run_lib((a0) => run_loop($running(a0)), 1),
  received: run_lib((a0) => run_loop($received(a0)), 1),
  onPhoto: run_lib((a0) => run_loop($onPhoto(a0)), 1),
  closeAs: run_lib((a0, a1) => run_loop($closeAs(a0, a1)), 2),
  "onClose.when": run_lib((a0, a1, a2) => run_loop($onClose_when(a0, a1, a2)), 3),
  onClose: run_lib((a0, a1) => run_loop($onClose(a0, a1)), 2),
  step: run_lib((a0, a1) => run_loop($step(a0, a1)), 2),
  maxFileBytes: run_lib(() => run_loop($maxFileBytes()), 0),
  maxSessionPhotos: run_lib(() => run_loop($maxSessionPhotos()), 0),
  maxSessionBytes: run_lib(() => run_loop($maxSessionBytes()), 0),
  idleMs: run_lib(() => run_loop($idleMs()), 0),
  routeDoor: run_lib((a0) => run_loop($routeDoor(a0)), 1),
  tokenDoor: run_lib((a0, a1) => run_loop($tokenDoor(a0, a1)), 2),
  door: run_lib((a0, a1, a2) => run_loop($door(a0, a1, a2)), 3),
  isImage: run_lib((a0) => run_loop($isImage(a0)), 1),
  acceptUnless: run_lib((a0) => run_loop($acceptUnless(a0)), 1),
  sessionFull: run_lib((a0, a1, a2) => run_loop($sessionFull(a0, a1, a2)), 3),
  "fitsFile.when": run_lib((a0, a1, a2, a3) => run_loop($fitsFile_when(a0, a1, a2, a3)), 4),
  fitsFile: run_lib((a0, a1, a2) => run_loop($fitsFile(a0, a1, a2)), 3),
  "imageVerdict.when": run_lib((a0, a1, a2, a3) => run_loop($imageVerdict_when(a0, a1, a2, a3)), 4),
  imageVerdict: run_lib((a0, a1, a2, a3) => run_loop($imageVerdict(a0, a1, a2, a3)), 4),
  photo: run_lib((a0, a1, a2, a3, a4) => run_loop($photo(a0, a1, a2, a3, a4)), 5),
  verdictStatus: run_lib((a0) => run_loop($verdictStatus(a0)), 1)
};
export {
  phonedrop_default as default
};

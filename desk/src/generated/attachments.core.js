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
  const x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(x_0, 1024) >>> 0;
}
function $maxTextChars$() {
  return 80000;
}
function $maxRawBytes$() {
  const x_0 = Math.imul(16, 1024) >>> 0;
  return Math.imul(x_0, 1024) >>> 0;
}
function $maxSendBytes$() {
  const x_0 = Math.imul(8, 1024) >>> 0;
  return Math.imul(x_0, 1024) >>> 0;
}
function $maxTotalBytes$() {
  const x_0 = Math.imul(28, 1024) >>> 0;
  return Math.imul(x_0, 1024) >>> 0;
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
function $scrubChar$go$(c_0, code_0) {
  const _t_0 = u32_to_word(code_0);
  const _t_1 = _t_0.head;
  if (!_t_1) {
    const _t_2 = _t_0.tail;
    const _t_3 = _t_2.head;
    if (_t_3) {
      const _t_4 = _t_2.tail;
      const _t_5 = _t_4.head;
      if (!_t_5) {
        const _t_6 = _t_4.tail;
        const _t_7 = _t_6.head;
        if (_t_7) {
          const _t_8 = _t_6.tail;
          const _t_9 = _t_8.head;
          if (!_t_9) {
            const _t_10 = _t_8.tail;
            const _t_11 = _t_10.head;
            if (!_t_11) {
              const _t_12 = _t_10.tail;
              const _t_13 = _t_12.head;
              if (!_t_13) {
                const _t_14 = _t_12.tail;
                const _t_15 = _t_14.head;
                if (!_t_15) {
                  const _t_16 = _t_14.tail;
                  const _t_17 = _t_16.head;
                  if (!_t_17) {
                    const _t_18 = _t_16.tail;
                    const _t_19 = _t_18.head;
                    if (!_t_19) {
                      const _t_20 = _t_18.tail;
                      const _t_21 = _t_20.head;
                      if (!_t_21) {
                        const _t_22 = _t_20.tail;
                        const _t_23 = _t_22.head;
                        if (!_t_23) {
                          const _t_24 = _t_22.tail;
                          const _t_25 = _t_24.head;
                          if (!_t_25) {
                            const _t_26 = _t_24.tail;
                            const _t_27 = _t_26.head;
                            if (!_t_27) {
                              const _t_28 = _t_26.tail;
                              const _t_29 = _t_28.head;
                              if (!_t_29) {
                                const _t_30 = _t_28.tail;
                                const _t_31 = _t_30.head;
                                if (!_t_31) {
                                  const _t_32 = _t_30.tail;
                                  const _t_33 = _t_32.head;
                                  if (!_t_33) {
                                    const _t_34 = _t_32.tail;
                                    const _t_35 = _t_34.head;
                                    if (!_t_35) {
                                      const _t_36 = _t_34.tail;
                                      const _t_37 = _t_36.head;
                                      if (!_t_37) {
                                        const _t_38 = _t_36.tail;
                                        const _t_39 = _t_38.head;
                                        if (!_t_39) {
                                          const _t_40 = _t_38.tail;
                                          const _t_41 = _t_40.head;
                                          if (!_t_41) {
                                            const _t_42 = _t_40.tail;
                                            const _t_43 = _t_42.head;
                                            if (!_t_43) {
                                              const _t_44 = _t_42.tail;
                                              const _t_45 = _t_44.head;
                                              if (!_t_45) {
                                                const _t_46 = _t_44.tail;
                                                const _t_47 = _t_46.head;
                                                if (!_t_47) {
                                                  const _t_48 = _t_46.tail;
                                                  const _t_49 = _t_48.head;
                                                  if (!_t_49) {
                                                    const _t_50 = _t_48.tail;
                                                    const _t_51 = _t_50.head;
                                                    if (!_t_51) {
                                                      const _t_52 = _t_50.tail;
                                                      const _t_53 = _t_52.head;
                                                      if (!_t_53) {
                                                        const _t_54 = _t_52.tail;
                                                        const _t_55 = _t_54.head;
                                                        if (!_t_55) {
                                                          const _t_56 = _t_54.tail;
                                                          const _t_57 = _t_56.head;
                                                          if (!_t_57) {
                                                            const _t_58 = _t_56.tail;
                                                            const _t_59 = _t_58.head;
                                                            if (!_t_59) {
                                                              const _t_60 = _t_58.tail;
                                                              const _t_61 = _t_60.head;
                                                              if (!_t_61) {
                                                                const _t_62 = _t_60.tail;
                                                                const _t_63 = _t_62.head;
                                                                if (!_t_63) {
                                                                  const _t_64 = _t_62.tail;
                                                                  return " ";
                                                                } else {
                                                                  const _71_0 = _t_62.tail;
                                                                  return c_0;
                                                                }
                                                              } else {
                                                                const _69_0 = _t_60.tail;
                                                                return c_0;
                                                              }
                                                            } else {
                                                              const _67_0 = _t_58.tail;
                                                              return c_0;
                                                            }
                                                          } else {
                                                            const _65_0 = _t_56.tail;
                                                            return c_0;
                                                          }
                                                        } else {
                                                          const _63_0 = _t_54.tail;
                                                          return c_0;
                                                        }
                                                      } else {
                                                        const _61_0 = _t_52.tail;
                                                        return c_0;
                                                      }
                                                    } else {
                                                      const _59_0 = _t_50.tail;
                                                      return c_0;
                                                    }
                                                  } else {
                                                    const _57_0 = _t_48.tail;
                                                    return c_0;
                                                  }
                                                } else {
                                                  const _55_0 = _t_46.tail;
                                                  return c_0;
                                                }
                                              } else {
                                                const _53_0 = _t_44.tail;
                                                return c_0;
                                              }
                                            } else {
                                              const _51_0 = _t_42.tail;
                                              return c_0;
                                            }
                                          } else {
                                            const _49_0 = _t_40.tail;
                                            return c_0;
                                          }
                                        } else {
                                          const _47_0 = _t_38.tail;
                                          return c_0;
                                        }
                                      } else {
                                        const _45_0 = _t_36.tail;
                                        return c_0;
                                      }
                                    } else {
                                      const _43_0 = _t_34.tail;
                                      return c_0;
                                    }
                                  } else {
                                    const _41_0 = _t_32.tail;
                                    return c_0;
                                  }
                                } else {
                                  const _39_0 = _t_30.tail;
                                  return c_0;
                                }
                              } else {
                                const _37_0 = _t_28.tail;
                                return c_0;
                              }
                            } else {
                              const _35_0 = _t_26.tail;
                              return c_0;
                            }
                          } else {
                            const _33_0 = _t_24.tail;
                            return c_0;
                          }
                        } else {
                          const _31_0 = _t_22.tail;
                          return c_0;
                        }
                      } else {
                        const _29_0 = _t_20.tail;
                        return c_0;
                      }
                    } else {
                      const _27_0 = _t_18.tail;
                      return c_0;
                    }
                  } else {
                    const _25_0 = _t_16.tail;
                    return c_0;
                  }
                } else {
                  const _23_0 = _t_14.tail;
                  return c_0;
                }
              } else {
                const _21_0 = _t_12.tail;
                return c_0;
              }
            } else {
              const _19_0 = _t_10.tail;
              return c_0;
            }
          } else {
            const _17_0 = _t_8.tail;
            return c_0;
          }
        } else {
          const _15_0 = _t_6.tail;
          return c_0;
        }
      } else {
        const _13_0 = _t_4.tail;
        return c_0;
      }
    } else {
      const _11_0 = _t_2.tail;
      return c_0;
    }
  } else {
    const _t_65 = _t_0.tail;
    const _t_66 = _t_65.head;
    if (!_t_66) {
      const _t_67 = _t_65.tail;
      const _t_68 = _t_67.head;
      if (_t_68) {
        const _t_69 = _t_67.tail;
        const _t_70 = _t_69.head;
        if (_t_70) {
          const _t_71 = _t_69.tail;
          const _t_72 = _t_71.head;
          if (!_t_72) {
            const _t_73 = _t_71.tail;
            const _t_74 = _t_73.head;
            if (!_t_74) {
              const _t_75 = _t_73.tail;
              const _t_76 = _t_75.head;
              if (!_t_76) {
                const _t_77 = _t_75.tail;
                const _t_78 = _t_77.head;
                if (!_t_78) {
                  const _t_79 = _t_77.tail;
                  const _t_80 = _t_79.head;
                  if (!_t_80) {
                    const _t_81 = _t_79.tail;
                    const _t_82 = _t_81.head;
                    if (!_t_82) {
                      const _t_83 = _t_81.tail;
                      const _t_84 = _t_83.head;
                      if (!_t_84) {
                        const _t_85 = _t_83.tail;
                        const _t_86 = _t_85.head;
                        if (!_t_86) {
                          const _t_87 = _t_85.tail;
                          const _t_88 = _t_87.head;
                          if (!_t_88) {
                            const _t_89 = _t_87.tail;
                            const _t_90 = _t_89.head;
                            if (!_t_90) {
                              const _t_91 = _t_89.tail;
                              const _t_92 = _t_91.head;
                              if (!_t_92) {
                                const _t_93 = _t_91.tail;
                                const _t_94 = _t_93.head;
                                if (!_t_94) {
                                  const _t_95 = _t_93.tail;
                                  const _t_96 = _t_95.head;
                                  if (!_t_96) {
                                    const _t_97 = _t_95.tail;
                                    const _t_98 = _t_97.head;
                                    if (!_t_98) {
                                      const _t_99 = _t_97.tail;
                                      const _t_100 = _t_99.head;
                                      if (!_t_100) {
                                        const _t_101 = _t_99.tail;
                                        const _t_102 = _t_101.head;
                                        if (!_t_102) {
                                          const _t_103 = _t_101.tail;
                                          const _t_104 = _t_103.head;
                                          if (!_t_104) {
                                            const _t_105 = _t_103.tail;
                                            const _t_106 = _t_105.head;
                                            if (!_t_106) {
                                              const _t_107 = _t_105.tail;
                                              const _t_108 = _t_107.head;
                                              if (!_t_108) {
                                                const _t_109 = _t_107.tail;
                                                const _t_110 = _t_109.head;
                                                if (!_t_110) {
                                                  const _t_111 = _t_109.tail;
                                                  const _t_112 = _t_111.head;
                                                  if (!_t_112) {
                                                    const _t_113 = _t_111.tail;
                                                    const _t_114 = _t_113.head;
                                                    if (!_t_114) {
                                                      const _t_115 = _t_113.tail;
                                                      const _t_116 = _t_115.head;
                                                      if (!_t_116) {
                                                        const _t_117 = _t_115.tail;
                                                        const _t_118 = _t_117.head;
                                                        if (!_t_118) {
                                                          const _t_119 = _t_117.tail;
                                                          const _t_120 = _t_119.head;
                                                          if (!_t_120) {
                                                            const _t_121 = _t_119.tail;
                                                            const _t_122 = _t_121.head;
                                                            if (!_t_122) {
                                                              const _t_123 = _t_121.tail;
                                                              const _t_124 = _t_123.head;
                                                              if (!_t_124) {
                                                                const _t_125 = _t_123.tail;
                                                                const _t_126 = _t_125.head;
                                                                if (!_t_126) {
                                                                  const _t_127 = _t_125.tail;
                                                                  return " ";
                                                                } else {
                                                                  const _133_0 = _t_125.tail;
                                                                  return c_0;
                                                                }
                                                              } else {
                                                                const _131_0 = _t_123.tail;
                                                                return c_0;
                                                              }
                                                            } else {
                                                              const _129_0 = _t_121.tail;
                                                              return c_0;
                                                            }
                                                          } else {
                                                            const _127_0 = _t_119.tail;
                                                            return c_0;
                                                          }
                                                        } else {
                                                          const _125_0 = _t_117.tail;
                                                          return c_0;
                                                        }
                                                      } else {
                                                        const _123_0 = _t_115.tail;
                                                        return c_0;
                                                      }
                                                    } else {
                                                      const _121_0 = _t_113.tail;
                                                      return c_0;
                                                    }
                                                  } else {
                                                    const _119_0 = _t_111.tail;
                                                    return c_0;
                                                  }
                                                } else {
                                                  const _117_0 = _t_109.tail;
                                                  return c_0;
                                                }
                                              } else {
                                                const _115_0 = _t_107.tail;
                                                return c_0;
                                              }
                                            } else {
                                              const _113_0 = _t_105.tail;
                                              return c_0;
                                            }
                                          } else {
                                            const _111_0 = _t_103.tail;
                                            return c_0;
                                          }
                                        } else {
                                          const _109_0 = _t_101.tail;
                                          return c_0;
                                        }
                                      } else {
                                        const _107_0 = _t_99.tail;
                                        return c_0;
                                      }
                                    } else {
                                      const _105_0 = _t_97.tail;
                                      return c_0;
                                    }
                                  } else {
                                    const _103_0 = _t_95.tail;
                                    return c_0;
                                  }
                                } else {
                                  const _101_0 = _t_93.tail;
                                  return c_0;
                                }
                              } else {
                                const _99_0 = _t_91.tail;
                                return c_0;
                              }
                            } else {
                              const _97_0 = _t_89.tail;
                              return c_0;
                            }
                          } else {
                            const _95_0 = _t_87.tail;
                            return c_0;
                          }
                        } else {
                          const _93_0 = _t_85.tail;
                          return c_0;
                        }
                      } else {
                        const _91_0 = _t_83.tail;
                        return c_0;
                      }
                    } else {
                      const _89_0 = _t_81.tail;
                      return c_0;
                    }
                  } else {
                    const _87_0 = _t_79.tail;
                    return c_0;
                  }
                } else {
                  const _85_0 = _t_77.tail;
                  return c_0;
                }
              } else {
                const _83_0 = _t_75.tail;
                return c_0;
              }
            } else {
              const _81_0 = _t_73.tail;
              return c_0;
            }
          } else {
            const _79_0 = _t_71.tail;
            return c_0;
          }
        } else {
          const _77_0 = _t_69.tail;
          return c_0;
        }
      } else {
        const _75_0 = _t_67.tail;
        return c_0;
      }
    } else {
      const _73_0 = _t_65.tail;
      return c_0;
    }
  }
}
function $scrubChar$(c_0) {
  return run_jump($scrubChar$go$, [c_0, run_loop($Char$to_u32$(c_0))]);
}
function $scrubName$go$(s_0, acc_0) {
  if (s_0 === "") {
    return run_jump($String$reverse$, [acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($scrubName$go$, [t_0, run_loop($scrubChar$(h_0)) + acc_0]);
  }
}
function $scrubName$(s_0) {
  return run_jump($scrubName$go$, [s_0, ""]);
}
function $nameOr$(default_0, name_0, empty_0) {
  if (empty_0) {
    return default_0;
  } else {
    return name_0;
  }
}
function $nameOr$if$(default_0, name_0) {
  return run_jump($nameOr$, [default_0, name_0, run_loop($String$is_empty$(name_0))]);
}
function $cleanName$(default_0, name_0) {
  return run_jump($String$take$, [run_loop($scrubName$(run_loop($nameOr$if$(default_0, name_0)))), run_loop($maxNameChars$())]);
}
function $cleanTextFile$(name_0, text_0) {
  return { $: "TextFile", ["name"]: run_loop($cleanName$(run_loop($defaultFileName$()), name_0)), ["text"]: text_0 };
}
function $allowedMime$(mime_0) {
  const x_0 = run_loop($String$eq$(mime_0, "image/webp"));
  const x_1 = run_loop($String$eq$(mime_0, "image/gif"));
  const x_2 = run_loop($String$eq$(mime_0, "image/jpg"));
  const x_3 = x_0 || x_1;
  const x_4 = run_loop($String$eq$(mime_0, "image/jpeg"));
  const x_5 = x_2 || x_3;
  const x_6 = run_loop($String$eq$(mime_0, "image/png"));
  const x_7 = x_4 || x_5;
  return x_6 || x_7;
}
function $canonMime$if$(mime_0, jpg_0) {
  if (jpg_0) {
    return "image/jpeg";
  } else {
    return mime_0;
  }
}
function $canonMime$(mime_0) {
  return run_jump($canonMime$if$, [mime_0, run_loop($String$eq$(mime_0, "image/jpg"))]);
}
function $partImage$dataUrl$(mime_0, mimeEmpty_0, data_0) {
  if (mimeEmpty_0) {
    const x_0 = run_loop($defaultImageMime$());
    const x_1 = ";base64," + data_0;
    const x_2 = x_0 + x_1;
    return "data:" + x_2;
  } else {
    const x_3 = ";base64," + data_0;
    const x_4 = mime_0 + x_3;
    return "data:" + x_4;
  }
}
function $partImage$mime$(mime_0, data_0) {
  return run_jump($partImage$dataUrl$, [mime_0, run_loop($String$is_empty$(mime_0)), data_0]);
}
function $partImage$data$(mime_0, data_0, dataEmpty_0) {
  if (dataEmpty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", ["value"]: run_loop($partImage$mime$(mime_0, data_0)) };
  }
}
function $partImage$src$(url_0, mime_0, data_0, urlEmpty_0, dataEmpty_0) {
  if (!urlEmpty_0) {
    return { $: "Some", ["value"]: url_0 };
  } else {
    return run_jump($partImage$data$, [mime_0, data_0, dataEmpty_0]);
  }
}
function $partImage$(kind_0, url_0, mime_0, data_0, isImage_0, urlEmpty_0, dataEmpty_0) {
  if (isImage_0) {
    return run_jump($partImage$src$, [url_0, mime_0, data_0, urlEmpty_0, dataEmpty_0]);
  } else {
    return { $: "None" };
  }
}
function $partVerdict$src$(pic_0) {
  if (pic_0.$ === "Some") {
    const src_0 = pic_0.value;
    return { $: "PartVerdict.Picture", ["src"]: src_0 };
  } else {
    return { $: "PartVerdict.Ignore" };
  }
}
function $partVerdict$go$(src_0, isText_0, text_0) {
  if (isText_0) {
    return { $: "PartVerdict.Text", ["text"]: text_0 };
  } else {
    return run_jump($partVerdict$src$, [src_0]);
  }
}
function $partVerdict$(p_0) {
  const kind_0 = p_0.kind;
  const text_0 = p_0.text;
  const data_0 = p_0.data;
  const url_0 = p_0.url;
  const mimeType_0 = p_0.mimeType;
  const kind_1 = kind_0;
  const data_1 = data_0;
  const url_1 = url_0;
  return run_jump($partVerdict$go$, [run_loop($partImage$(kind_1, url_1, mimeType_0, data_1, run_loop($String$eq$(kind_1, "image")), run_loop($String$is_empty$(url_1)), run_loop($String$is_empty$(data_1)))), run_loop($String$eq$(kind_1, "text")), text_0]);
}
function $partVerdicts$(parts_0) {
  if (parts_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = parts_0.head;
    const t_0 = parts_0.tail;
    return { $: "Con", ["head"]: run_loop($partVerdict$(h_0)), ["tail"]: run_loop($partVerdicts$(t_0)) };
  }
}
function $scanParts$(parts_0, texts_0, images_0) {
  if (parts_0.$ === "Nil") {
    return { $: "Content", ["text"]: run_loop($String$join$(texts_0, `
`)), ["images"]: images_0 };
  } else {
    const _t_0 = parts_0.head;
    if (_t_0.$ === "PartVerdict.Text") {
      const text_0 = _t_0.text;
      const t_0 = parts_0.tail;
      return run_jump($scanParts$, [t_0, run_loop($List$append$(texts_0, { $: "Con", ["head"]: text_0, ["tail"]: { $: "Nil" } })), images_0]);
    } else if (_t_0.$ === "PartVerdict.Picture") {
      const src_0 = _t_0.src;
      const t_1 = parts_0.tail;
      return run_jump($scanParts$, [t_1, texts_0, run_loop($List$append$(images_0, { $: "Con", ["head"]: src_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const t_2 = parts_0.tail;
      return run_jump($scanParts$, [t_2, texts_0, images_0]);
    }
  }
}
function $contentParts$(isString_0, text_0, parts_0) {
  if (isString_0) {
    return { $: "Content", ["text"]: text_0, ["images"]: { $: "Nil" } };
  } else {
    return run_jump($scanParts$, [run_loop($partVerdicts$(parts_0)), { $: "Nil" }, { $: "Nil" }]);
  }
}
function $contentText$(c_0) {
  const text_0 = c_0.text;
  const images_0 = c_0.images;
  return text_0;
}
function $contentImages$(c_0) {
  const text_0 = c_0.text;
  const images_0 = c_0.images;
  return images_0;
}
function $imageVerdict$mime$(mimeOk_0, dataUrl_0, name_0) {
  if (!mimeOk_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return { $: "ImageVerdict.Keep", ["attachment"]: { $: "Attachment", ["dataUrl"]: dataUrl_0, ["name"]: run_loop($cleanName$(run_loop($defaultImageName$()), name_0)) } };
  }
}
function $imageVerdict$valid$(valid_0, mimeOk_0, dataUrl_0, name_0) {
  if (!valid_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($imageVerdict$mime$, [mimeOk_0, dataUrl_0, name_0]);
  }
}
function $imageVerdict$over$(overRaw_0, valid_0, mimeOk_0, dataUrl_0, name_0) {
  if (overRaw_0) {
    return { $: "ImageVerdict.Reject", ["reason"]: { $: "AttachError.ImageTooLarge" } };
  } else {
    return run_jump($imageVerdict$valid$, [valid_0, mimeOk_0, dataUrl_0, name_0]);
  }
}
function $imageVerdict$(item_0) {
  const dataUrl_0 = item_0.dataUrl;
  const mime_0 = item_0.mime;
  const name_0 = item_0.name;
  const valid_0 = item_0.valid;
  const overRaw_0 = item_0.overRaw;
  return run_jump($imageVerdict$over$, [overRaw_0, valid_0, run_loop($allowedMime$(mime_0)), dataUrl_0, name_0]);
}
function $fileVerdict$empty$(empty_0, file_0) {
  if (empty_0) {
    return { $: "FileVerdict.Drop" };
  } else {
    return { $: "FileVerdict.Keep", ["file"]: file_0 };
  }
}
function $fileVerdict$over$(over_0, empty_0, name_0, text_0) {
  if (over_0) {
    return { $: "FileVerdict.Reject", ["reason"]: { $: "AttachError.FileTooLarge" } };
  } else {
    return run_jump($fileVerdict$empty$, [empty_0, run_loop($cleanTextFile$(name_0, text_0))]);
  }
}
function $fileVerdict$(item_0) {
  const name_0 = item_0.name;
  const text_0 = item_0.text;
  const over_0 = item_0.over;
  const text_1 = text_0;
  return run_jump($fileVerdict$over$, [over_0, run_loop($String$is_empty$(text_1)), name_0, text_1]);
}
function $imageVerdicts$(items_0) {
  if (items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = items_0.head;
    const t_0 = items_0.tail;
    return { $: "Con", ["head"]: run_loop($imageVerdict$(h_0)), ["tail"]: run_loop($imageVerdicts$(t_0)) };
  }
}
function $fileVerdicts$(files_0) {
  if (files_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = files_0.head;
    const t_0 = files_0.tail;
    return { $: "Con", ["head"]: run_loop($fileVerdict$(h_0)), ["tail"]: run_loop($fileVerdicts$(t_0)) };
  }
}
function $collectImages$(items_0, acc_0) {
  if (items_0.$ === "Nil") {
    return { $: "DraftImages", ["images"]: acc_0, ["reason"]: { $: "None" } };
  } else {
    const _t_0 = items_0.head;
    if (_t_0.$ === "ImageVerdict.Keep") {
      const attachment_0 = _t_0.attachment;
      const t_0 = items_0.tail;
      return run_jump($collectImages$, [t_0, run_loop($List$append$(acc_0, { $: "Con", ["head"]: attachment_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const reason_0 = _t_0.reason;
      const t_1 = items_0.tail;
      return { $: "DraftImages", ["images"]: acc_0, ["reason"]: { $: "Some", ["value"]: reason_0 } };
    }
  }
}
function $collectFiles$(files_0, acc_0) {
  if (files_0.$ === "Nil") {
    return { $: "DraftFiles", ["files"]: acc_0, ["reason"]: { $: "None" } };
  } else {
    const _t_0 = files_0.head;
    if (_t_0.$ === "FileVerdict.Keep") {
      const file_0 = _t_0.file;
      const t_0 = files_0.tail;
      return run_jump($collectFiles$, [t_0, run_loop($List$append$(acc_0, { $: "Con", ["head"]: file_0, ["tail"]: { $: "Nil" } }))]);
    } else if (_t_0.$ === "FileVerdict.Drop") {
      const t_1 = files_0.tail;
      return run_jump($collectFiles$, [t_1, acc_0]);
    } else {
      const reason_0 = _t_0.reason;
      const t_2 = files_0.tail;
      return { $: "DraftFiles", ["files"]: acc_0, ["reason"]: { $: "Some", ["value"]: reason_0 } };
    }
  }
}
function $finishDraftFiles$(images_0, files_0) {
  const files_1 = files_0.files;
  const _t_0 = files_0.reason;
  if (_t_0.$ === "Some") {
    const r_0 = _t_0.value;
    return { $: "AttachResult.Bad", ["reason"]: r_0 };
  } else {
    return { $: "AttachResult.Ok", ["images"]: images_0, ["files"]: files_1 };
  }
}
function $finishDraft$(imgs_0, files_0) {
  const images_0 = imgs_0.images;
  const _t_0 = imgs_0.reason;
  if (_t_0.$ === "Some") {
    const r_0 = _t_0.value;
    return { $: "AttachResult.Bad", ["reason"]: r_0 };
  } else {
    return run_jump($finishDraftFiles$, [images_0, run_loop($collectFiles$(run_loop($fileVerdicts$(run_loop($List$take$(files_0, run_loop($maxFiles$()))))), { $: "Nil" }))]);
  }
}
function $normalizeAttachments$(images_0, files_0) {
  return run_jump($finishDraft$, [run_loop($collectImages$(run_loop($imageVerdicts$(run_loop($List$take$(images_0, run_loop($maxImages$()))))), { $: "Nil" })), files_0]);
}
function $attachImages$(r_0) {
  if (r_0.$ === "AttachResult.Ok") {
    const images_0 = r_0.images;
    const files_0 = r_0.files;
    return images_0;
  } else {
    const reason_0 = r_0.reason;
    return { $: "Nil" };
  }
}
function $attachFiles$(r_0) {
  if (r_0.$ === "AttachResult.Ok") {
    const images_0 = r_0.images;
    const files_0 = r_0.files;
    return files_0;
  } else {
    const reason_0 = r_0.reason;
    return { $: "Nil" };
  }
}
function $attachReason$(r_0) {
  if (r_0.$ === "AttachResult.Ok") {
    const images_0 = r_0.images;
    const files_0 = r_0.files;
    return { $: "None" };
  } else {
    const reason_0 = r_0.reason;
    return { $: "Some", ["value"]: reason_0 };
  }
}
function $sendVerdict$total$(overTotal_0, mime_0) {
  if (overTotal_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.TotalTooLarge" } };
  } else {
    return { $: "SendVerdict.Keep", ["mime"]: run_loop($canonMime$(mime_0)) };
  }
}
function $sendVerdict$send$(overSend_0, overTotal_0, mime_0) {
  if (overSend_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.ReducedTooLarge" } };
  } else {
    return run_jump($sendVerdict$total$, [overTotal_0, mime_0]);
  }
}
function $sendVerdict$raw$(overRaw_0, overSend_0, overTotal_0, mime_0) {
  if (overRaw_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.ImageTooLarge" } };
  } else {
    return run_jump($sendVerdict$send$, [overSend_0, overTotal_0, mime_0]);
  }
}
function $sendVerdict$mime$(mimeOk_0, overRaw_0, overSend_0, overTotal_0, mime_0) {
  if (!mimeOk_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($sendVerdict$raw$, [overRaw_0, overSend_0, overTotal_0, mime_0]);
  }
}
function $sendVerdict$valid$(valid_0, mimeOk_0, overRaw_0, overSend_0, overTotal_0, mime_0) {
  if (!valid_0) {
    return { $: "SendVerdict.Reject", ["reason"]: { $: "AttachError.BadType" } };
  } else {
    return run_jump($sendVerdict$mime$, [mimeOk_0, overRaw_0, overSend_0, overTotal_0, mime_0]);
  }
}
function $sendVerdict$(item_0) {
  const mime_0 = item_0.mime;
  const valid_0 = item_0.valid;
  const overRaw_0 = item_0.overRaw;
  const overSend_0 = item_0.overSend;
  const overTotal_0 = item_0.overTotal;
  const mime_1 = mime_0;
  return run_jump($sendVerdict$valid$, [valid_0, run_loop($allowedMime$(mime_1)), overRaw_0, overSend_0, overTotal_0, mime_1]);
}
function $sendVerdicts$(items_0) {
  if (items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = items_0.head;
    const t_0 = items_0.tail;
    return { $: "Con", ["head"]: run_loop($sendVerdict$(h_0)), ["tail"]: run_loop($sendVerdicts$(t_0)) };
  }
}
function $collectMimes$(items_0, acc_0) {
  if (items_0.$ === "Nil") {
    return { $: "SendResult.Ok", ["mimes"]: acc_0 };
  } else {
    const _t_0 = items_0.head;
    if (_t_0.$ === "SendVerdict.Keep") {
      const mime_0 = _t_0.mime;
      const t_0 = items_0.tail;
      return run_jump($collectMimes$, [t_0, run_loop($List$append$(acc_0, { $: "Con", ["head"]: mime_0, ["tail"]: { $: "Nil" } }))]);
    } else {
      const reason_0 = _t_0.reason;
      const t_1 = items_0.tail;
      return { $: "SendResult.Bad", ["reason"]: reason_0 };
    }
  }
}
function $promptImages$(items_0) {
  return run_jump($collectMimes$, [run_loop($sendVerdicts$(run_loop($List$take$(items_0, run_loop($maxImages$()))))), { $: "Nil" }]);
}
function $sentMimes$(r_0) {
  if (r_0.$ === "SendResult.Ok") {
    const mimes_0 = r_0.mimes;
    return mimes_0;
  } else {
    const reason_0 = r_0.reason;
    return { $: "Nil" };
  }
}
function $sentReason$(r_0) {
  if (r_0.$ === "SendResult.Ok") {
    const mimes_0 = r_0.mimes;
    return { $: "None" };
  } else {
    const reason_0 = r_0.reason;
    return { $: "Some", ["value"]: reason_0 };
  }
}
function $Char$to_u32$(c_0) {
  const x_0 = c_0.codePointAt(0);
  return x_0;
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $String$is_empty$(s_0) {
  if (s_0 === "") {
    return true;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return false;
  }
}
function $String$take$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return "";
    } else {
      const p_0 = n_0 - 1n;
      return h_0 + run_loop($String$take$(t_0, p_0));
    }
  }
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
}
function $String$join$(xs_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return "";
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($String$join$go$, [t_0, h_0, sep_0]);
  }
}
function $List$append$(xs_0, ys_0) {
  if (xs_0.$ === "Nil") {
    return ys_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$append$(t_0, ys_0)) };
  }
}
function $List$take$(xs_0, n_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    if (n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const p_0 = n_0 - 1n;
      return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$take$(t_0, p_0)) };
    }
  }
}
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $String$eq$fin$(r_0) {
  const _t_0 = r_0.fst;
  const a2_0 = _t_0.fst;
  const b2_0 = _t_0.snd;
  const c_0 = r_0.snd;
  return run_jump($Cmp$is_eq$, [c_0]);
}
function $String$cmp$(a_0, b_0) {
  if (a_0 === "") {
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const h_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: h_0 + t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const h_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(0, 2) : a_0[0];
    const t_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(2) : a_0.slice(1);
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h_1 + t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const h2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return run_jump($String$cmp$fin$, [t_1, t2_0, run_loop($Char$cmp$(h_1, h2_0))]);
    }
  }
}
function $String$join$go$(xs_0, h_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return h_0;
  } else {
    const h2_0 = xs_0.head;
    const t_0 = xs_0.tail;
    const x_0 = run_loop($String$join$go$(t_0, h2_0, sep_0));
    const x_1 = sep_0 + x_0;
    return h_0 + x_1;
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(t1_0, t2_0, hc_0) {
  const _t_0 = hc_0.fst;
  const h1b_0 = _t_0.fst;
  const h2b_0 = _t_0.snd;
  const _t_1 = hc_0.snd;
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [h1b_0, h2b_0, run_loop($String$cmp$(t1_0, t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  const x_1 = x_0;
  const y_1 = y_0;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(x_1), ["snd"]: char_new(y_1) }, ["snd"]: cmp_new(x_1, y_1) };
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
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

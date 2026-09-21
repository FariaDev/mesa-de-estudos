/* Tags dos construtores do `worklog.bend` como o artefato da VIEW os vê.
   O bend 2.0.6 emite os construtores SEM o prefixo do módulo (ex.: `Thinking`,
   `Status.Failed`); o núcleo do log só casa `Thinking`/`Running` e transporta o
   resto (`worklog.mjs`). Este mapa é do consumidor `worklogview`. Mora fora do
   `worklog-view.mjs` para o teste poder importá-lo sem DOM. */
export const VIEW_KIND_CORE={
 thinking:{$:'Thinking'},search:{$:'Search'},
 reference:{$:'Reference'},fetch:{$:'Fetch'},
 tool:{$:'Tool'},error:{$:'ErrorKind'},
};
export const VIEW_STATUS_CORE={
 running:{$:'Status.Running'},done:{$:'Status.Done'},
 stopped:{$:'Status.Stopped'},error:{$:'Status.Failed'},
};

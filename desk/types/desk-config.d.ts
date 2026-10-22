/* A config normalizada (`config.cjs` → `normalize`), como o main a guarda em
   `live.config` (#43 fase 3). Os padrões continuam no `config.cjs`; aqui só o
   formato. `desk` é o schema da mesa (docs/agents/customizar.md): os campos que
   os arquivos verificados leem estão nomeados, o resto fica como `unknown`. */
export type CourseEntry = {id: string, name: string, path: string};
export type DeskSettings = {studyContext?: boolean, [field: string]: unknown};
export type DeskConfig = {
 vaultPath: string,
 runtimePath: string,
 piPath: string,
 claudePath: string,
 xournalPath: string,
 courses: CourseEntry[],
 desk: DeskSettings,
};

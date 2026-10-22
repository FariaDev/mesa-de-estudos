// @ts-check
/* Nomes que a aba Livre grava em português e mostra no idioma da interface (#41).
   O título padrão da sessão (`core/freeworkspaces.bend` `defaultTitle`) fica no
   disco como está, para o dado antigo continuar valendo; só a exibição traduz. */
import {t} from './ui-text.mjs';

/** Título padrão gravado pelo núcleo; qualquer outro título é do usuário e fica como veio. */
export const STORED_DEFAULT_FREE_TITLE = 'Sessão livre';

/**
 * @param {string} title título gravado da sessão Livre
 * @returns {string} o título padrão no idioma da interface, ou o próprio título
 * @example displayFreeTitle('Sessão livre') // 'Free session' com a interface em inglês
 */
export function displayFreeTitle(title) {
  return title === STORED_DEFAULT_FREE_TITLE ? t('free.title.placeholder') : title;
}

/** Id reservado da aba Livre (`core/freeworkspaces.bend` `freeCourseId`). */
export const FREE_COURSE_ID = 'mesa-free';

/**
 * Nome de matéria para mostrar: a aba Livre vem do main com o nome em português.
 * @param {{id?: string, name?: string}|null|undefined} course
 * @returns {string}
 * @example displayCourseName({id: 'mesa-free', name: 'Livre'}) // 'Free' com a interface em inglês
 */
export function displayCourseName(course) {
  return course?.id === FREE_COURSE_ID ? t('free.tab') : String(course?.name || '');
}

/**
 * Lista de matérias com a aba Livre chamada pelo nome do idioma atual.
 * @param {Array<{id?: string, name?: string, kind?: string}>} courses
 */
export function localizeFreeCourse(courses) {
  return (courses || []).map((course) => (course?.kind === 'free' ? {...course, name: t('free.tab')} : course));
}

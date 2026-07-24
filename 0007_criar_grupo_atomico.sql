/**
 * Único e-mail autorizado a criar novos grupos (provisionar o sistema
 * para um novo gestor/cliente). A checagem real de segurança acontece no
 * banco (função criar_grupo) -- isto aqui só controla qual tela mostrar.
 */
export const MASTER_EMAIL = "victornogueirapinto@gmail.com";

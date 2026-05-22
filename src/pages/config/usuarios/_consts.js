// PAPEIS — papéis do sistema com labels, cores, e permissões.
// Extraído de UsuariosConfig.jsx em 22/mai/2026 (fatiamento Etapa 8).

export const PAPEIS = [
  { value: 'admin_polimata',     label: 'Admin Polímata',     desc: 'Acesso total a todos os clientes e configurações', cor: '#CC915E',
    pode: ['Visualizar todos os clientes e projetos', 'Criar e gerenciar usuários', 'Editar todas as análises', 'Configurar o sistema'] },
  { value: 'consultor_polimata', label: 'Consultor Polímata', desc: 'Edita análises, faz upload de fichas, baixa relatórios', cor: '#3B82F6',
    pode: ['Editar análises nos projetos vinculados', 'Upload de fichas e documentos', 'Download de relatórios'] },
  { value: 'gestor_cliente',     label: 'Gestor do Cliente',  desc: 'Vê todas as áreas do projeto, somente consulta e download', cor: '#22C55E',
    pode: ['Visualizar todas as áreas do projeto', 'Download de relatórios', 'Consulta somente (sem edição)'] },
  { value: 'usuario_cliente',    label: 'Usuário Cliente',    desc: 'Acesso às áreas atribuídas, somente consulta e download', cor: '#A78BFA',
    pode: ['Visualizar áreas atribuídas', 'Download de relatórios', 'Consulta somente (sem edição)'] },
]


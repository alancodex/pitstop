# PitStop Lava Jato — site de agendamento

Site público (PWA, mobile first) + painel administrativo em `/admin`, usando o mesmo banco Supabase.
Tudo é HTML/CSS/JS puro: **não precisa instalar nada nem compilar**. Basta hospedar a pasta.

## Cores da marca (extraídas da logo)
Azul-marinho `#073F6E` · Vermelho `#FC3132` · Branco. Fonte de títulos: Barlow Condensed (condensada, como o logotipo).

## Publicar em 4 passos

### 1) Criar o banco (Supabase — plano gratuito serve)
1. Crie um projeto em supabase.com.
2. Abra **SQL Editor → New query**, cole todo o arquivo `supabase/schema.sql` e clique **Run**.
3. **Authentication → Users → Add user**: crie o e-mail/senha do dono.
4. No SQL Editor, torne esse usuário administrador (troque o e-mail):
   ```sql
   insert into public.admins (user_id, role)
   select id, 'owner' from auth.users where email = 'dono@exemplo.com';
   ```
   Funcionários: crie o usuário igual e use `'staff'` (confirmam/cancelam/reagendam, mas não excluem registros nem mudam preços).
5. **Authentication → Providers → Email**: desative **"Allow new users to sign up"** (ninguém além de você cria contas).

> **Já criou o banco com a versão anterior?** Não rode o `schema.sql` de novo. Rode só `supabase/atualizacao-moto-com-cera.sql` (adiciona a lavagem de moto com cera e atualiza o que cada lavagem inclui, sem mexer nos preços que você já alterou).

### 2) Configurar o site
Edite `js/config.js`:
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` (Project Settings → API). Use a chave **anon/publishable**, nunca a `service_role`.
- `WHATSAPP`: já está `558198919952` (+55 81 9891-9952). Se o WhatsApp não abrir a conversa, o número provavelmente tem o 9 extra de celular — confirme com o dono.

### 3) Hospedar a pasta
Netlify, Vercel, Cloudflare Pages ou GitHub Pages (arraste/envie a pasta inteira). Precisa de HTTPS (todas dão).
- Site: `https://seudominio.com`
- Painel: `https://seudominio.com/admin/`

### 4) Testar
Faça um agendamento pelo celular, abra `/admin/`, entre e confirme.

## Como funciona
- **Sem Supabase configurado** o site roda em *modo demonstração* (salva só no aparelho, com faixa amarela). Serve para ver o visual.
- **Reserva do horário**: ao tocar em *Confirmar pelo WhatsApp*, o pedido é gravado como **"Aguardando confirmação"** e o WhatsApp abre com a mensagem pronta. O horário fica reservado pelo prazo configurado (padrão **120 min**, mude em Admin → Ajustes). Se o dono não confirmar até lá, o horário volta a ficar livre sozinho.
- **Sem horários duplicados**: garantido no próprio banco (índice único + trava). Testado com 12 pedidos simultâneos no mesmo horário: só 1 passou.
- **Regras no servidor** (não dá para burlar pelo navegador): segunda a sábado, 08–17h, almoço 12–13h, sem datas passadas, serviço compatível com o veículo, preço sempre vindo do banco, até 60 dias à frente.
- **Segurança**: clientes não leem nem alteram nenhum agendamento (RLS); só enxergam quais horários estão ocupados, sem nomes. Painel exige login do Supabase Auth e conferência na tabela `admins`; sem isso o banco recusa tudo, mesmo que alguém descubra o endereço `/admin/`.
- **Painel**: indicadores do dia, lista com filtros (data, veículo, serviço, status), calendário semanal/diário colorido por status, confirmar / iniciar / concluir / cancelar / reagendar / excluir (só dono), histórico de cada reserva, bloqueio de horários ou dia inteiro, WhatsApp do cliente (quando o painel tiver o telefone anotado) e do PitStop.

## Serviços e preços
| Veículo | Serviço | Preço | O que inclui |
|---|---|---|---|
| Carro | Lavagem completa com cera | R$ 65,00 | Lavagem externa · Aspiração interna · Limpeza do painel · Aplicação de cera |
| Carro | Lavagem sem cera | R$ 45,00 | Lavagem externa · Aspiração interna · Limpeza do painel |
| Moto | Lavagem completa com cera | R$ 50,00 | Lavagem · Restaurador para os plásticos · Aplicação de cera Vonixx com 3 meses de proteção · Selante para pneus |
| Moto | Lavagem sem cera | R$ 35,00 | Lavagem · Pretinho nos pneus |

Preço e "o que inclui" (um item por linha) podem ser editados pelo proprietário em **Painel → Ajustes**, sem mexer no código.

## Fotos
Adicione novas fotos em `assets/galeria/` e inclua uma linha em `GALLERY` no `js/config.js` (informe largura/altura reais; gere também uma miniatura de 900 px de altura). As imagens aparecem inteiras, na proporção original, sem cortes.

## Observações
- Os emojis da mensagem do WhatsApp estão escritos como códigos unicode (`\u{1F44B}` etc.) em `js/app.js`, para não dependerem da codificação do arquivo ou do servidor.
- O cliente informa só o nome, então o botão de WhatsApp do cliente no painel só aparece depois que alguém anotar o telefone em *Detalhes*.
- Horários de atendimento mudaram? Altere `SLOTS`/`OPEN_DAYS` em `js/config.js` **e** a função `business_slots()` / regra de domingo em `supabase/schema.sql`.
- Instalar como app: Android mostra "Instalar app"; no iPhone, Compartilhar → Adicionar à Tela de Início.

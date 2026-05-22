create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  level int not null default 1 check (level >= 1),
  exp int not null default 0 check (exp >= 0),
  role text not null default 'member' check (role in ('admin', 'member', 'vip')),
  avatar text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
add column if not exists created_at timestamptz not null default now();

alter table public.users
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  min_level int not null default 0,
  is_public boolean not null default false,
  tags text[] default '{}',
  attachments text[] default '{}',
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts
add column if not exists created_at timestamptz not null default now();

alter table public.posts
add column if not exists updated_at timestamptz not null default now();

alter table public.posts
add column if not exists author_id uuid references public.users(id) on delete set null;

alter table public.posts add column if not exists attachments text[] default '{}';

create table if not exists public.user_exp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  exp int not null check (exp > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.user_exp_logs enable row level security;
alter table public.comments enable row level security;

-- =========================
-- PRIVILEGES
-- =========================

grant usage on schema public to anon, authenticated;

grant select on public.posts to anon;
grant select on public.comments to anon;

grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert on public.user_exp_logs to authenticated;
grant select, insert, update, delete on public.comments to authenticated;

create or replace function public.is_admin_user(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = _uid
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated;

-- =========================
-- USERS POLICIES
-- =========================

drop policy if exists "users_select_self_or_admin" on public.users;

create policy "users_select_self_or_admin"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists "users_insert_self" on public.users;

create policy "users_insert_self"
on public.users
for insert
to authenticated
with check (
  id = auth.uid()
);

drop policy if exists "users_update_self" on public.users;

create policy "users_update_self"
on public.users
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);

drop policy if exists "users_update_admin" on public.users;

create policy "users_update_admin"
on public.users
for update
to authenticated
using (
  public.is_admin_user(auth.uid())
)
with check (
  public.is_admin_user(auth.uid())
);

-- =========================
-- POSTS POLICIES
-- =========================

drop policy if exists "posts_public_read" on public.posts;

create policy "posts_public_read"
on public.posts
for select
to anon, authenticated
using (
  is_public = true
);

drop policy if exists "posts_level_read" on public.posts;

create policy "posts_level_read"
on public.posts
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.role = 'admin'
        or u.level >= public.posts.min_level
      )
  )
);

drop policy if exists "posts_admin_write" on public.posts;

create policy "posts_admin_write"
on public.posts
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "posts_author_insert" on public.posts;

create policy "posts_author_insert"
on public.posts
for insert
to authenticated
with check (
  author_id = auth.uid()
);

drop policy if exists "posts_author_update" on public.posts;

create policy "posts_author_update"
on public.posts
for update
to authenticated
using (
  author_id = auth.uid()
)
with check (
  author_id = auth.uid()
);

drop policy if exists "posts_author_delete" on public.posts;

create policy "posts_author_delete"
on public.posts
for delete
to authenticated
using (
  author_id = auth.uid()
);

-- =========================
-- EXP LOGS POLICIES
-- =========================

drop policy if exists "exp_logs_select_self_or_admin" on public.user_exp_logs;

create policy "exp_logs_select_self_or_admin"
on public.user_exp_logs
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

drop policy if exists "exp_logs_insert_self_or_admin" on public.user_exp_logs;

create policy "exp_logs_insert_self_or_admin"
on public.user_exp_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

-- =========================
-- COMMENTS POLICIES
-- =========================

drop policy if exists "comments_read_all" on public.comments;

create policy "comments_read_all"
on public.comments
for select
to anon, authenticated
using (
  true
);

drop policy if exists "comments_insert_self" on public.comments;

create policy "comments_insert_self"
on public.comments
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "comments_update_self" on public.comments;

create policy "comments_update_self"
on public.comments
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists "comments_delete_self" on public.comments;

create policy "comments_delete_self"
on public.comments
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- =========================
-- SEED DATA
-- =========================

delete from public.posts
where title in (
  'Welcome to WuSphere',
  'AI Tool Stack Notes',
  'Hidden Workflow Blueprint',
  'AI 时代的个人知识管理',
  'Prompt Engineering 核心技巧：从入门到实战',
  'AI Agent 架构解析：如何让 AI 自动完成复杂任务',
  '用 AI 构建个人变现系统：从内容到收入的完整链路',
  'AI 工具选型指南 2025：哪些值得深耕，哪些是噱头'
)
and author_id is null;

insert into public.posts (
  title,
  content,
  min_level,
  is_public,
  tags
)
values
(
  '什么是人工智能：从规则系统到大语言模型的技术演进',
  '# 什么是人工智能\n\n人工智能并不是某一种单一技术，而是一组围绕“让机器执行原本需要人类智能才能完成的任务”展开的方法集合。早期的 AI 主要依赖人工编写规则，例如专家系统会把领域知识拆解成大量 if-then 条件，再由推理引擎做判断。这种方法在规则明确、边界稳定的场景中有一定价值，但一旦问题空间快速变化，维护成本就会急剧上升。\n\n过去十年，机器学习逐渐取代纯规则式方法，核心原因在于它允许系统从数据中学习模式，而不是完全依赖人工预设逻辑。随后，深度学习通过多层神经网络显著提高了视觉识别、语音识别和自然语言处理等任务的性能。如今，大语言模型进一步把“概率预测下一个词”扩展成一种通用的语言能力接口，企业和个人都能通过提示词、工具调用和工作流编排快速搭建 AI 应用。\n\n理解 AI 的最好方式，不是把它看作魔法，而是把它理解为“数据、模型、算力、反馈机制”共同构成的系统工程。真正决定 AI 能否产生商业价值的，不只是模型是否先进，还包括数据是否可靠、业务流程是否适合重构、以及组织是否具备持续迭代的能力。对于普通用户而言，学会把 AI 当成一种能力放大器，而不是替代所有判断的黑盒，是进入这个时代最重要的第一步。',
  0,
  true,
  array['ai', '基础', 'llm', '历史']
),
(
  'Prompt Engineering 实战方法论：如何稳定得到高质量输出',
  '# Prompt Engineering 实战方法论\n\n很多人第一次使用大模型时会产生误解：只要模型足够强，输入一句模糊的问题也应该得到完美回答。现实恰好相反。模型的上限由能力决定，但输出的稳定性往往由输入的结构决定。所谓 Prompt Engineering，本质上是在做任务定义、上下文压缩和输出控制。\n\n一个高质量提示词通常包含四个要素：角色设定、任务目标、输入上下文和输出格式。角色设定帮助模型收敛语气与专业范围，任务目标说明这次回答真正要解决什么问题，上下文则补足模型在当前对话中尚未掌握的业务信息，输出格式用来减少回答发散。例如，让模型“分析一篇文章”往往不够具体，但如果要求“站在 B2B SaaS 内容策略顾问的角度，给出文章摘要、受众判断、结构问题和三条可执行改进建议”，结果就会显著提升。\n\n进阶阶段的 Prompt Engineering 不只是写一句更长的话，而是要把复杂任务拆成多个阶段。先让模型确认理解，再要求列出假设，再进入产出步骤，最后用自检问题回头校验，这比一次性要求它完成所有工作更稳定。对于团队协作而言，把高频任务沉淀成可复用提示模板，比依赖个人灵感更有价值。真正成熟的提示工程，不是“写得玄”，而是让输出可复用、可评估、可持续优化。',
  1,
  false,
  array['ai', 'prompt', '提示词', '推理']
),
(
  'AI Agent 的工作原理：模型、工具、记忆与工作流如何协同',
  '# AI Agent 的工作原理\n\nAI Agent 之所以成为近两年的核心话题，是因为它不再停留在“回答问题”的层面，而是试图让模型主动完成一个多步骤任务。一个基本的 Agent 通常包括四个部件：模型、工具、状态记忆和决策循环。模型负责理解目标与生成下一步动作，工具负责让模型接触外部世界，例如搜索、数据库、邮件、代码执行等；记忆用于保存上下文与中间状态，决策循环则让整个系统不断观察、思考、行动、再观察。\n\nAgent 的价值并不在于让模型表现得像人，而在于把原本分散在多个界面、多个步骤中的操作折叠成一个连贯流程。例如，市场团队每周要做竞品追踪，传统方法是人工搜索、复制、归纳、写报告。引入 Agent 后，可以让模型自动检索信息、提取结构化数据、总结变化点，并输出标准模板。这种能力在知识密集型工作中有明显优势。\n\n但 Agent 系统也有明显边界。它容易在长链路任务中累积误差，对外部工具权限和数据质量高度敏感，还可能因为一次错误的中间判断把后续步骤全部带偏。因此，真正可用的 Agent 更像“带护栏的自动化系统”，而不是完全自主的智能体。企业在部署 Agent 时，最应该关注的是可观察性、回滚机制和人工接管点，而不是表面上的自主程度。',
  2,
  false,
  array['ai', 'agent', 'workflow', '自动化']
),
(
  '企业如何把 AI 落地到业务流程：从试点到规模化的关键路径',
  '# 企业如何把 AI 落地到业务流程\n\n很多企业在引入 AI 时，最先遇到的问题不是模型效果不够好，而是不知道应该从哪里开始。一个常见误区是先买模型、再找场景，结果往往是做出几个看起来新鲜、但无法真正进入生产流程的演示项目。更有效的方法通常相反：先识别组织中重复度高、文本密度高、决策链相对明确的任务，再判断是否适合用 AI 改造。\n\n从落地路径看，企业级 AI 实施通常分为四步。第一步是识别高价值场景，例如客服质检、销售纪要整理、知识库问答、招投标文档分析等；第二步是建立数据供给与权限边界，确保模型获得的上下文既足够准确，又不会突破合规要求；第三步是把模型能力嵌入已有业务流程，而不是强迫员工切换到全新的工作界面；第四步是持续评估，通过准确率、响应速度、人工节省时长和业务转化指标来判断是否继续扩展。\n\n真正决定 AI 能否规模化的，不是单个 Demo 的惊艳程度，而是组织是否具备“流程重构 + 数据治理 + 人机协作”的综合能力。那些最成功的 AI 项目，往往不是技术团队单独完成的，而是业务、产品、数据、法务和安全团队共同参与的结果。AI 在企业内部的最佳角色，不是替代所有岗位，而是重新划分哪些工作由人来判断，哪些工作由系统来加速。',
  1,
  true,
  array['ai', '企业', '应用', '组织']
),
(
  '生成式 AI 的治理与风险：安全、幻觉、版权与组织责任',
  '# 生成式 AI 的治理与风险\n\n随着生成式 AI 进入实际业务环境，治理问题从“是否重要”变成了“必须先解决”。企业在部署 AI 时，最常见的四类风险分别是：内容幻觉、数据泄露、版权归属不清，以及不可解释的决策结果。很多团队一开始只关注输出是否足够聪明，却忽略了系统是否足够可控，等到模型真正接触客户、合同、代码和内部知识时，这些问题就会迅速暴露。\n\n治理并不意味着一味限制使用，而是建立清晰的边界和责任机制。首先，应明确哪些数据可以进入模型、哪些数据必须脱敏、哪些场景禁止外部 API 处理；其次，要为高风险任务增加人工审核环节，尤其是法律、医疗、金融和安全相关内容；再次，组织需要保留提示词、上下文、输出和用户反馈的审计链路，方便排查错误来源。没有日志和版本控制的 AI 系统，一旦出现错误，很难快速定位。\n\n从长期看，AI 治理能力会成为企业竞争力的一部分。谁能更快建立可靠的评测体系、权限策略和应急机制，谁就更有可能把 AI 从实验室工具变成真正稳定的生产力基础设施。生成式 AI 的未来不只取决于模型参数规模，也取决于我们是否愿意把技术的边界、责任和成本一起设计进去。',
  2,
  false,
  array['ai', '治理', '安全', '风险', '合规']
)
on conflict do nothing;
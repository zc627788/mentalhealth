# AI预约系统功能实现文档

## 📋 项目概述

本项目实现了一个完整的AI预约系统，支持人类咨询师和AI助手（豆包、Peppy）的预约管理。系统包含用户端预约界面、管理端后台和智能路由控制。

## 🚀 核心功能

### 1. 动态登录重定向
- **功能描述**: 根据系统设置自动决定用户登录后的跳转页面
- **实现逻辑**:
  - AI预约开启 → 跳转到 `/appointment`
  - AI预约关闭 → 跳转到 `/dashboard`

### 2. AI预约管理
- **功能描述**: AI服务支持预约模式，与人类咨询师统一管理
- **实现方式**:
  - 在管理端"时间管理"中添加AI可用时间
  - 用户端统一显示为"专业咨询师"选项
  - AI预约数据存储在 `counselors` 表中

### 3. 智能路由保护
- **功能描述**: 防止用户直接访问受保护的路由
- **保护机制**:
  - 检查AI预约设置
  - 验证用户是否有有效的AI预约
  - 自动重定向到正确的页面

### 4. 预约状态管理
- **功能描述**: 完整的预约生命周期管理
- **状态类型**:
  - 可预约（绿色显示）
  - 已被预约（灰色显示，不可点击）
  - 已过期（自动过滤）

### 5. 会议链接管理
- **功能描述**: 统一管理人类咨询师的会议链接
- **实现方式**:
  - 管理端设置会议链接（Zoom、腾讯会议等）
  - 用户端显示会议链接状态
  - 支持直接加入会议和复制链接功能

## 🗄️ 数据库结构

### 核心表结构

#### 1. `counselors` 表
```sql
-- 支持人类和AI咨询师
ALTER TABLE public.counselors ADD COLUMN counselor_type character varying DEFAULT 'human';
ALTER TABLE public.counselors ADD COLUMN ai_model character varying;

-- AI咨询师记录
INSERT INTO public.counselors (id, name, title, speciality, experience, rating, bio, available, counselor_type, ai_model)
VALUES
  ('00000000-0000-0000-0000-000000000001', '豆包AI助手', 'AI心理咨询师', 'AI心理支持、情绪疏导、认知行为指导', 'AI技术支持', 5.0, '基于先进AI技术的智能心理咨询助手，提供24/7心理支持服务', TRUE, 'ai', 'doubao'),
  ('00000000-0000-0000-0000-000000000002', 'PeppyAI助手', 'AI心理咨询师', 'AI心理支持、情绪疏导、认知行为指导', 'AI技术支持', 5.0, '基于先进AI技术的智能心理咨询助手，提供24/7心理支持服务', TRUE, 'ai', 'peppy');
```

#### 2. `counselor_availability` 表
```sql
-- 支持AI和人类咨询师的时间管理
ALTER TABLE public.counselor_availability ADD COLUMN counselor_type character varying DEFAULT 'human';
ALTER TABLE public.counselor_availability ADD COLUMN ai_model character varying;
```

#### 3. `appointments` 表
```sql
-- 支持AI预约类型
ALTER TABLE public.appointments ADD COLUMN ai_model character varying;
```

#### 4. `system_settings` 表
```sql
-- 系统设置表
CREATE TABLE public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key character varying UNIQUE NOT NULL,
  setting_value character varying NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- AI预约设置
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('ai_appointment_required', 'true');
```

## 🔧 技术实现

### 1. 路由保护系统

#### `src/App.tsx` - 核心路由逻辑
```typescript
// RootRedirect 组件 - 处理根路径重定向
function RootRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  useEffect(() => {
    const checkRedirectPath = async () => {
      if (user && !loading) {
        const { data: aiAppointmentRequired } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "ai_appointment_required")
          .maybeSingle();
        
        if (aiAppointmentRequired?.setting_value === "true") {
          setRedirectPath("/appointment");
        } else {
          setRedirectPath("/dashboard");
        }
      }
    };
    checkRedirectPath();
  }, [user, loading]);
  
  // 显示加载状态直到路径确定
  if (loading || redirectPath === null) {
    return <LoadingSpinner />;
  }
  
  return <Navigate to={redirectPath} replace />;
}

// ProtectedRoute 组件 - 保护特定路由
function ProtectedRoute({ children, path }: { children: React.ReactNode; path?: string; }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkRouteAccess = async () => {
      if (["/chat-doubao", "/chat-peppy", "/dashboard"].includes(path || "")) {
        const { data: aiAppointmentRequired } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "ai_appointment_required")
          .maybeSingle();

        if (aiAppointmentRequired?.setting_value === "true") {
          // 检查用户是否有有效的AI预约
          const { data: userAppointments } = await supabase
            .from('appointments')
            .select('appointment_type, ai_model, appointment_date, start_time, status')
            .eq('user_id', user.id)
            .eq('status', 'confirmed')
            .gte('appointment_date', new Date().toISOString().split('T')[0]);

          const hasValidAiAppointment = userAppointments?.some(apt => {
            if (apt.appointment_type !== 'ai') return false;
            const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.start_time}`);
            const now = new Date();
            if (appointmentDateTime > now) return false; // 预约时间必须已到达
            if (path === '/chat-doubao' && apt.ai_model === 'doubao') return true;
            if (path === '/chat-peppy' && apt.ai_model === 'peppy') return true;
            return false;
          });

          if (!hasValidAiAppointment) {
            navigate("/appointment", { replace: true });
          }
        }
      }
    };
    if (user) { checkRouteAccess(); }
  }, [user, path]);
  
  return <>{children}</>;
}
```

### 2. 预约系统

#### `src/components/Appointment.tsx` - 用户预约界面
```typescript
// 预约创建逻辑
const handleBookAppointment = async () => {
  const appointmentData: any = {
    user_id: user.id,
    appointment_type: selectedAvailability.counselor_type, // 'ai' 或 'human'
    appointment_date: selectedAvailability.availability_date,
    start_time: selectedAvailability.start_time,
    end_time: selectedAvailability.end_time,
    topic: formData.topic.trim(),
    description: formData.description.trim(),
    urgency: formData.urgency,
    counselor_id: selectedAvailability.counselor_id,
    counselor_name: selectedAvailability.counselor.name,
    availability_id: selectedAvailability.id,
    user_email: user.email || '',
    status: 'confirmed'
  };

  // 如果是AI预约，添加ai_model字段
  if (selectedAvailability.counselor_type === 'ai') {
    appointmentData.ai_model = selectedAvailability.ai_model;
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert([appointmentData])
    .select();

  // 更新可用时间段为已预约
  await supabase
    .from('counselor_availability')
    .update({ is_booked: true })
    .eq('id', selectedAvailability.id);
};

// AI预约的"点击进入"按钮
{appointment.appointment_type === 'ai' && appointment.status === 'confirmed' && (
  <button
    onClick={() => {
      if (appointment.ai_model === 'doubao') {
        navigate('/chat-doubao')
      } else if (appointment.ai_model === 'peppy') {
        navigate('/chat-peppy')
      }
    }}
    disabled={!isTimeReached}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isTimeReached
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }`}
    title={!isTimeReached ? '未到开始时间' : ''}
  >
    点击进入
  </button>
)}
```

### 3. 管理端系统

#### `src/components/AdminDashboard.tsx` - 管理后台
```typescript
// 系统设置管理
const handleSaveSettings = async () => {
  for (const [key, value] of Object.entries(settingsForm)) {
    const { error } = await supabase.from("system_settings").upsert(
      {
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "setting_key",
        ignoreDuplicates: false,
      }
    );
  }
};

// AI可用时间添加
const handleAddAvailability = async () => {
  const { error } = await supabase.from("counselor_availability").insert([
    {
      counselor_id: availabilityForm.counselor_type === "ai"
        ? availabilityForm.ai_model === "doubao"
          ? "00000000-0000-0000-0000-000000000001"
          : "00000000-0000-0000-0000-000000000002"
        : availabilityForm.counselor_id,
      counselor_type: availabilityForm.counselor_type,
      ai_model: availabilityForm.counselor_type === "ai" ? availabilityForm.ai_model : null,
      availability_date: availabilityForm.availability_date,
      start_time: availabilityForm.start_time,
      end_time: availabilityForm.end_time,
      notes: availabilityForm.notes,
      created_by: adminUUID,
    },
  ]);
};
```

### 4. AI聊天页面

#### `src/components/ChatDoubao.tsx` 和 `src/components/ChatPeppy.tsx`
```typescript
// 动态返回逻辑
const handleGoBack = async () => {
  try {
    const { data: aiAppointmentRequired } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_appointment_required')
      .maybeSingle()

    if (aiAppointmentRequired?.setting_value === 'true') {
      navigate('/appointment')  // AI预约开启时返回预约页面
    } else {
      navigate('/dashboard')    // AI预约关闭时返回仪表板
    }
  } catch (error) {
    console.error('检查跳转路径失败:', error)
    navigate('/appointment') // 默认跳转到预约页面
  }
}
```

## 📁 文件结构

```
src/
├── App.tsx                    # 主路由配置和路由保护
├── components/
│   ├── Appointment.tsx       # 用户预约界面
│   ├── AdminDashboard.tsx    # 管理后台
│   ├── ChatDoubao.tsx        # 豆包AI聊天页面
│   ├── ChatPeppy.tsx         # Peppy AI聊天页面
│   ├── Login.tsx             # 登录页面
│   └── Dashboard.tsx         # 用户仪表板
├── contexts/
│   └── AuthContext.tsx      # 认证上下文
└── lib/
    ├── supabase.ts          # Supabase配置
    └── chatStorage.ts       # 聊天存储服务
```

## 🚀 部署和配置

### 1. 数据库迁移
```bash
# 执行数据库迁移脚本
psql -d your_database -f database_ai_counselor_migration.sql
psql -d your_database -f fix_system_settings.sql
psql -d your_database -f cleanup_old_ai_records.sql
```

### 2. 环境变量
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 系统设置
- 在管理后台的"系统设置"中配置 `ai_appointment_required`
- 设置为 `true` 启用AI预约模式
- 设置为 `false` 禁用AI预约模式

## 🔄 业务流程

### AI预约开启模式
1. 用户登录 → 自动跳转到 `/appointment`
2. 选择可用的AI时间段 → 填写预约信息
3. 预约成功 → 在"我的预约"中显示
4. 到达预约时间 → 点击"点击进入"进入AI聊天
5. 聊天结束 → 点击返回按钮回到预约页面

### AI预约关闭模式
1. 用户登录 → 自动跳转到 `/dashboard`
2. 直接访问AI聊天页面（无需预约）
3. 聊天结束 → 点击返回按钮回到仪表板

### 人类咨询师预约模式
1. 用户选择人类咨询师时间段 → 填写预约信息
2. 预约成功 → 在"我的预约"中显示"会议安排中"状态
3. 管理员设置会议链接 → 用户端自动更新为"会议链接已安排"
4. 用户可点击"加入会议"直接进入会议，或"复制链接"分享

## 🐛 问题修复记录

### 1. 路由保护问题
- **问题**: 直接访问 `/dashboard` 时出现白屏
- **解决**: 使用 `useNavigate` 替代 `Navigate` 组件，避免路由冲突

### 2. 预约数据问题
- **问题**: AI预约的 `appointment_type` 和 `ai_model` 字段不正确
- **解决**: 修改预约创建逻辑，直接插入数据库并正确设置字段

### 3. 管理端咨询师列表问题
- **问题**: 人类咨询师列表中显示AI咨询师
- **解决**: 添加过滤条件 `counselor_type !== 'ai'`

### 4. AI聊天返回问题
- **问题**: 从AI聊天返回后无法重新进入
- **解决**: 实现动态返回逻辑，根据系统设置决定返回目标

### 5. 会议链接功能同步
- **问题**: MyAppointments页面的会议链接功能未同步到Appointment页面
- **解决**: 在Appointment页面的"我的预约"标签页中添加完整的会议链接管理功能

## 📊 系统特性

### ✅ 已实现功能
- [x] 动态登录重定向
- [x] AI预约管理
- [x] 智能路由保护
- [x] 预约状态管理
- [x] 管理端时间管理
- [x] 用户端预约界面
- [x] AI聊天页面
- [x] 系统设置管理
- [x] 会议链接管理

### 🔮 未来扩展
- [ ] 预约提醒功能
- [ ] 预约取消和重新安排
- [ ] 多语言支持
- [ ] 移动端优化
- [ ] 预约统计分析

## 📞 技术支持

如有问题或需要技术支持，请参考：
1. 检查控制台错误信息
2. 确认数据库连接状态
3. 验证系统设置配置
4. 查看网络请求日志

---

**最后更新**: 2024年12月
**版本**: v1.0.0
**状态**: 生产就绪

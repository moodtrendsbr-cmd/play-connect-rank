-- ============================================
-- FASE 3 — ARENA MANAGEMENT
-- ============================================

-- 1. arena_students
CREATE TABLE public.arena_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  profile_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_arena_students_arena ON public.arena_students(arena_id, status);
CREATE INDEX idx_arena_students_profile ON public.arena_students(profile_user_id) WHERE profile_user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_arena_students_email ON public.arena_students(arena_id, lower(email)) WHERE email IS NOT NULL;

-- 2. arena_instructors
CREATE TABLE public.arena_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  profile_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  status text NOT NULL DEFAULT 'active',
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_arena_instructors_arena ON public.arena_instructors(arena_id, status);
CREATE UNIQUE INDEX uq_arena_instructors_profile ON public.arena_instructors(arena_id, profile_user_id) WHERE profile_user_id IS NOT NULL;

-- 3. arena_instructor_availability
CREATE TABLE public.arena_instructor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES public.arena_instructors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_arena_instructor_avail_instructor ON public.arena_instructor_availability(instructor_id, weekday);

-- 4. arena_classes
CREATE TABLE public.arena_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES public.arena_instructors(id) ON DELETE SET NULL,
  court_id uuid REFERENCES public.courts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  modality text,
  level text NOT NULL DEFAULT 'livre',
  recurrence text NOT NULL DEFAULT 'none',
  weekday smallint CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'scheduled',
  price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_arena_classes_arena_start ON public.arena_classes(arena_id, start_at);
CREATE INDEX idx_arena_classes_instructor ON public.arena_classes(instructor_id);

-- 5. arena_class_enrollments
CREATE TABLE public.arena_class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.arena_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.arena_students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  payment_status text NOT NULL DEFAULT 'none',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
CREATE INDEX idx_arena_class_enroll_class ON public.arena_class_enrollments(class_id);
CREATE INDEX idx_arena_class_enroll_student ON public.arena_class_enrollments(student_id);

-- 6. arena_attendance
CREATE TABLE public.arena_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.arena_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.arena_students(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.arena_class_enrollments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'present',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  check_in_method text NOT NULL DEFAULT 'manual',
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
CREATE INDEX idx_arena_attendance_class ON public.arena_attendance(class_id);
CREATE INDEX idx_arena_attendance_student ON public.arena_attendance(student_id);

-- 7. arena_checkin_tokens
CREATE TABLE public.arena_checkin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.arena_classes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_arena_checkin_token ON public.arena_checkin_tokens(token);
CREATE INDEX idx_arena_checkin_class ON public.arena_checkin_tokens(class_id);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.arena_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_instructor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_checkin_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TENANT DEFAULT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.set_arena_child_tenant_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.arenas WHERE id = NEW.arena_id LIMIT 1;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_tenant_arena_students BEFORE INSERT ON public.arena_students
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_set_tenant_arena_instructors BEFORE INSERT ON public.arena_instructors
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_set_tenant_arena_classes BEFORE INSERT ON public.arena_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_set_tenant_arena_class_enroll BEFORE INSERT ON public.arena_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_set_tenant_arena_attendance BEFORE INSERT ON public.arena_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();
CREATE TRIGGER trg_set_tenant_arena_checkin BEFORE INSERT ON public.arena_checkin_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_arena_child_tenant_default();

-- updated_at triggers
CREATE TRIGGER trg_upd_arena_students BEFORE UPDATE ON public.arena_students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_arena_instructors BEFORE UPDATE ON public.arena_instructors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_arena_classes BEFORE UPDATE ON public.arena_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_arena_class_enroll BEFORE UPDATE ON public.arena_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES — padrão: arena owner + tenant admin + admin global
-- ============================================

-- arena_students
CREATE POLICY "arena_students_view" ON public.arena_students FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
    OR (profile_user_id IS NOT NULL AND profile_user_id = auth.uid())
  );
CREATE POLICY "arena_students_insert" ON public.arena_students FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_students_update" ON public.arena_students FOR UPDATE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_students_delete" ON public.arena_students FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- arena_instructors
CREATE POLICY "arena_instructors_view" ON public.arena_instructors FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
    OR (profile_user_id IS NOT NULL AND profile_user_id = auth.uid())
  );
CREATE POLICY "arena_instructors_insert" ON public.arena_instructors FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_instructors_update" ON public.arena_instructors FOR UPDATE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_instructors_delete" ON public.arena_instructors FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- arena_instructor_availability (segue dono do instructor)
CREATE OR REPLACE FUNCTION public.get_arena_id_from_instructor(_instructor_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT arena_id FROM public.arena_instructors WHERE id = _instructor_id LIMIT 1
$$;

CREATE POLICY "arena_instr_avail_view" ON public.arena_instructor_availability FOR SELECT
  USING (
    is_arena_owner(get_arena_id_from_instructor(instructor_id), auth.uid())
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_instr_avail_manage" ON public.arena_instructor_availability FOR ALL
  USING (
    is_arena_owner(get_arena_id_from_instructor(instructor_id), auth.uid())
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    is_arena_owner(get_arena_id_from_instructor(instructor_id), auth.uid())
    OR is_admin(auth.uid())
  );

-- arena_classes
CREATE POLICY "arena_classes_view" ON public.arena_classes FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.arena_class_enrollments ace
      JOIN public.arena_students s ON s.id = ace.student_id
      WHERE ace.class_id = arena_classes.id AND s.profile_user_id = auth.uid()
    )
  );
CREATE POLICY "arena_classes_insert" ON public.arena_classes FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_classes_update" ON public.arena_classes FOR UPDATE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_classes_delete" ON public.arena_classes FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- arena_class_enrollments
CREATE POLICY "arena_class_enroll_view" ON public.arena_class_enrollments FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.arena_students s
      WHERE s.id = student_id AND s.profile_user_id = auth.uid()
    )
  );
CREATE POLICY "arena_class_enroll_insert" ON public.arena_class_enrollments FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_class_enroll_update" ON public.arena_class_enrollments FOR UPDATE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_class_enroll_delete" ON public.arena_class_enrollments FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- arena_attendance
CREATE POLICY "arena_attendance_view" ON public.arena_attendance FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.arena_students s
      WHERE s.id = student_id AND s.profile_user_id = auth.uid()
    )
  );
CREATE POLICY "arena_attendance_insert" ON public.arena_attendance FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_attendance_update" ON public.arena_attendance FOR UPDATE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_attendance_delete" ON public.arena_attendance FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- arena_checkin_tokens (token é segredo — só owner/admin)
CREATE POLICY "arena_checkin_tokens_view" ON public.arena_checkin_tokens FOR SELECT
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_checkin_tokens_insert" ON public.arena_checkin_tokens FOR INSERT
  WITH CHECK (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );
CREATE POLICY "arena_checkin_tokens_delete" ON public.arena_checkin_tokens FOR DELETE
  USING (
    is_arena_owner(arena_id, auth.uid())
    OR (tenant_id IS NOT NULL AND is_tenant_admin(tenant_id, auth.uid()))
    OR is_admin(auth.uid())
  );

-- ============================================
-- RPC: arena_checkin_validate
-- ============================================
CREATE OR REPLACE FUNCTION public.arena_checkin_validate(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_token_row record;
  v_class record;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_attendance_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth_required');
  END IF;

  SELECT * INTO v_token_row FROM public.arena_checkin_tokens WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_token_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired_token');
  END IF;

  SELECT id, title, arena_id, tenant_id INTO v_class
  FROM public.arena_classes WHERE id = v_token_row.class_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'class_not_found');
  END IF;

  SELECT id INTO v_student_id FROM public.arena_students
    WHERE arena_id = v_class.arena_id AND profile_user_id = v_user LIMIT 1;
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_student');
  END IF;

  SELECT id INTO v_enrollment_id FROM public.arena_class_enrollments
    WHERE class_id = v_class.id AND student_id = v_student_id AND status = 'active' LIMIT 1;
  IF v_enrollment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enrolled');
  END IF;

  INSERT INTO public.arena_attendance (
    tenant_id, arena_id, class_id, student_id, enrollment_id,
    status, checked_in_at, check_in_method, recorded_by
  ) VALUES (
    v_class.tenant_id, v_class.arena_id, v_class.id, v_student_id, v_enrollment_id,
    'present', now(), 'qr', v_user
  )
  ON CONFLICT (class_id, student_id) DO UPDATE
    SET status = 'present', checked_in_at = now(), check_in_method = 'qr', recorded_by = v_user
  RETURNING id INTO v_attendance_id;

  RETURN jsonb_build_object(
    'success', true,
    'class_title', v_class.title,
    'checked_in_at', now(),
    'attendance_id', v_attendance_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.arena_checkin_validate(text) TO authenticated;
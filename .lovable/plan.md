
# Correcao: Acesso Admin Bloqueado (Race Condition)

## Problema
O `AuthContext.tsx` tem uma race condition critica:

1. `onAuthStateChange` dispara **antes** de `getSession` com a sessao do usuario
2. Dentro do callback, o codigo faz `await fetchRole()` -- que chama Supabase **dentro** de um callback de auth, causando deadlock
3. O `loading` fica `true` indefinidamente, ou `userRole` fica `null` quando o `AdminLayout` verifica
4. Resultado: o admin e redirecionado para `/dashboard`

## Solucao

Reescrever o `useEffect` do `AuthContext.tsx` seguindo o padrao correto:

1. **`onAuthStateChange`**: Nunca fazer `await` de chamadas Supabase dentro dele. Usar `setTimeout` para despachar a busca de role fora do callback (evita deadlock)
2. **`getSession`**: Buscar a role **antes** de setar `loading = false` -- este e o unico lugar que controla o loading inicial
3. Adicionar flag `isMounted` para evitar updates em componentes desmontados

### Codigo alterado em `src/contexts/AuthContext.tsx`:

```text
useEffect(() => {
  let isMounted = true;

  // Listener - NÃO controla loading inicial
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchRole(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
      }
    }
  );

  // Inicializacao - CONTROLA loading
  const initialize = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchRole(session.user.id);
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  initialize();

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);
```

Pontos-chave:
- `onAuthStateChange` usa `setTimeout` para evitar deadlock (nunca await dentro do callback)
- `setLoading(false)` so acontece **depois** de `fetchRole` completar na inicializacao
- `isMounted` previne memory leaks

Nenhuma alteracao necessaria no `AdminLayout.tsx` -- a logica de protecao la esta correta, o problema e exclusivamente no timing do AuthContext.

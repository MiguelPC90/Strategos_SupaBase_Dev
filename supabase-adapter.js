/**
 * supabase-adapter.js — Strategos PMO
 *
 * Adaptador Supabase que expõe window.SB.
 * Inclua este ficheiro APÓS o CDN do Supabase:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="supabase-adapter.js"></script>
 *
 * Configure SUPABASE_URL e SUPABASE_ANON_KEY antes de usar.
 */

(function () {
  'use strict';

  // ── Configuração ─────────────────────────────────────────────
  // Substitua pelos valores do seu projecto Supabase
  var SUPABASE_URL      = window.SUPABASE_URL      || '';
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  // ── Objecto global SB ────────────────────────────────────────
  var SB = {
    client        : null,
    isOnline      : false,
    currentUserId : null,
    _channel      : null,

    // ── Inicialização ──────────────────────────────────────────
    init: async function () {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[SB] SUPABASE_URL ou SUPABASE_ANON_KEY não configurados. A usar modo local.');
        this.isOnline = false;
        return;
      }
      try {
        this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        var res = await this.client.auth.getSession();
        this.isOnline = true;
        if (res.data && res.data.session) {
          this.currentUserId = res.data.session.user.id;
        }
      } catch (e) {
        console.warn('[SB] Supabase indisponível, a usar localStorage.', e);
        this.isOnline = false;
      }
    },

    // ── Autenticação ───────────────────────────────────────────
    signIn: async function (email, password) {
      var res = await this.client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      this.currentUserId = res.data.user.id;
      return res.data;
    },

    signOut: async function () {
      await this.client.auth.signOut();
      this.currentUserId = null;
    },

    getSession: async function () {
      var res = await this.client.auth.getSession();
      return res.data.session;
    },

    onAuthStateChange: function (callback) {
      return this.client.auth.onAuthStateChange(callback);
    },

    // ── getUserMeta: devolve metadados + perfil do utilizador ──
    getUserMeta: async function (userId) {
      var res = await this.client
        .from('user_metadata')
        .select('*, user_profiles(*)')
        .eq('id', userId)
        .single();
      if (res.error) throw res.error;
      return res.data;
    },

    // ── Mapeamento interno: linha DB → objecto app ─────────────
    _mapActivity: function (row) {
      return {
        nivel    : row.nivel,
        nome     : row.nome,
        n0       : row.n0      || '',
        n1       : row.n1      || '',
        n2       : row.n2      || '',
        n3       : row.n3      || '',
        id0      : row.id0     || '1',
        id1      : row.id1     || '',
        id2      : row.id2     || '',
        bs       : row.bs,
        bf       : row.bf,
        rs       : row.rs,
        rf       : row.rf,
        pct      : Number(row.pct      || 0),
        pct_prev : Number(row.pct_prev || 0),
        status   : row.status  || 'Em dia',
        sponsor  : row.sponsor || '',
        owner    : row.owner   || '',
        finish   : row.finish,
        notes    : row.notes,
        _supabase_id : row.id
      };
    },

    _mapPDS: function (row) {
      var risks = (row.risks || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (r) {
          return {
            desc       : r.description || '',
            impact     : r.impact,
            prob       : r.prob,
            status     : r.status,
            mitigation : r.mitigation || '',
            _supabase_id : r.id
          };
        });

      var rubricas = (row.fin_rubricas || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (r) {
          return {
            id        : r.app_id || r.id,
            categoria : r.categoria,
            capex     : r.capex,
            moeda     : r.moeda,
            valores   : r.valores || {},
            nota      : r.nota   || '',
            fonte     : r.fonte  || '',
            _supabase_id : r.id
          };
        });

      var contratos = (row.fin_contratos || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (c) {
          return {
            id          : c.app_id || c.id,
            fornecedor  : c.fornecedor  || '',
            categoria   : c.categoria   || '',
            moeda       : c.moeda       || '€',
            cambio_ref  : c.cambio_ref,
            valor_total : c.valor_total || 0,
            data_adj    : c.data_adj,
            descricao   : c.descricao   || '',
            _supabase_id : c.id
          };
        });

      var facturas = (row.fin_facturas || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (f) {
          return {
            id              : f.app_id || f.id,
            contrato_id     : f.app_contrato_id || '',
            ref             : f.ref             || '',
            fornecedor      : f.fornecedor       || '',
            doc_tipo        : f.doc_tipo,
            descricao       : f.descricao        || '',
            valor           : f.valor            || 0,
            moeda           : f.moeda            || '€',
            cambio          : f.cambio,
            data_emissao    : f.data_emissao,
            data_vencimento : f.data_vencimento,
            data_pagamento  : f.data_pagamento,
            estado          : f.estado           || 'Por facturar',
            memorando       : f.memorando        || '',
            _supabase_id    : f.id
          };
        });

      return {
        id0                : row.id0   || '1',
        id1                : row.id1   || '',
        id2                : row.id2   || '',
        plano              : row.plano || '',
        n0                 : row.n0    || '',
        n1                 : row.n1    || '',
        compromissos_items : row.compromissos_items || [],
        avancos_items      : row.avancos_items      || [],
        proximos_items     : row.proximos_items     || [],
        atencao_items      : row.atencao_items      || [],
        compromissos       : row.compromissos,
        avancos            : row.avancos,
        proximos           : row.proximos,
        atencao            : row.atencao,
        risks              : risks,
        finances           : {
          rubricas : rubricas,
          contratos: contratos,
          facturas : facturas
        },
        _supabase_id : row.id
      };
    },

    // ── Carregamento de dados ──────────────────────────────────

    loadActivities: async function () {
      var res = await this.client
        .from('activities')
        .select('*')
        .eq('source', 'gantt')
        .order('sort_order', { ascending: true });
      if (res.error) throw res.error;
      return res.data.map(this._mapActivity);
    },

    loadPDS: async function () {
      var res = await this.client
        .from('pds_entries')
        .select('*, risks(*), fin_rubricas(*), fin_contratos(*), fin_facturas(*)')
        .order('id');
      if (res.error) throw res.error;
      var self = this;
      return res.data.map(function (row) { return self._mapPDS(row); });
    },

    loadSnapshots: async function () {
      var res = await this.client
        .from('snapshots')
        .select('*')
        .order('snap_date', { ascending: true });
      if (res.error) throw res.error;
      return res.data.map(function (s) {
        return {
          timestamp  : s.snap_date,
          label      : s.label,
          kpis       : s.kpi   || {},
          byN1       : s.by_n1 || {},
          byN0       : s.by_n0 || {},
          _supabase_id : s.id
        };
      });
    },

    loadConfig: async function () {
      var res = await this.client
        .from('app_config')
        .select('data')
        .eq('config_key', 'main')
        .single();
      if (res.error) throw res.error;
      return res.data ? res.data.data : null;
    },

    // ── Guardar Actividades (full-replace por gantt) ───────────
    saveActivities: async function (ganttRows) {
      var self = this;
      var rows = ganttRows.map(function (r, i) {
        return {
          source    : 'gantt',
          nivel     : r.nivel,
          nome      : r.nome      || '',
          n0        : r.n0        || '',
          n1        : r.n1        || '',
          n2        : r.n2        || '',
          n3        : r.n3        || '',
          id0       : r.id0       || '1',
          id1       : r.id1       || '',
          id2       : r.id2       || '',
          bs        : r.bs        || null,
          bf        : r.bf        || null,
          rs        : r.rs        || null,
          rf        : r.rf        || null,
          pct       : r.pct       || 0,
          pct_prev  : r.pct_prev  || 0,
          status    : r.status    || 'Em dia',
          sponsor   : r.sponsor   || '',
          owner     : r.owner     || '',
          finish    : r.finish    || null,
          notes     : r.notes     || null,
          sort_order: i,
          updated_by: self.currentUserId
        };
      });

      // Apagar apenas as linhas gantt do(s) id0 presentes nos dados enviados
      // Isto garante que importações por programa não apagam outros programas
      var id0sToReplace = [...new Set(rows.map(function(r){ return r.id0; }))];
      for (var j = 0; j < id0sToReplace.length; j++) {
        var delRes = await this.client
          .from('activities')
          .delete()
          .eq('source', 'gantt')
          .eq('id0', id0sToReplace[j]);
        if (delRes.error) throw delRes.error;
      }

      // Inserir em chunks de 500
      for (var i = 0; i < rows.length; i += 500) {
        var chunk = rows.slice(i, i + 500);
        var insRes = await this.client.from('activities').insert(chunk);
        if (insRes.error) throw insRes.error;
      }
    },

    // ── Recursos: mapeamento, load e save ────────────────────
    _mapResource: function (r) {
      return {
        _supabase_id    : r.id,
        id0             : r.id0,
        id1             : r.id1             || null,
        id2             : r.id2             || null,
        nome            : r.nome,
        unidade         : r.unidade         || '',
        perfil          : r.perfil          || '',
        alocacao_total  : Number(r.alocacao_total)   || 0,
        alocacao_projeto: Number(r.alocacao_projeto) || 0,
        periodo_inicio  : r.periodo_inicio  || null,
        periodo_fim     : r.periodo_fim     || null,
        custo_hora      : r.custo_hora != null ? Number(r.custo_hora) : null,
        notas           : r.notas           || '',
        sort_order      : r.sort_order      || 0
      };
    },

    loadResources: async function (id0s) {
      var q = this.client.from('resources').select('*').order('sort_order');
      if (id0s && id0s.length) q = q.in('id0', id0s);
      var res = await q;
      if (res.error) throw res.error;
      return (res.data || []).map(function (r) { return SB._mapResource(r); });
    },

    saveResources: async function (id0, rows) {
      // delete-by-id0 then insert (mesmo padrão de saveRisks)
      var del = await this.client.from('resources').delete().eq('id0', id0);
      if (del.error) throw del.error;
      if (!rows || !rows.length) return;
      var self = this;
      var ins = rows.map(function (r, i) {
        return {
          id0             : id0,
          id1             : r.id1             || null,
          id2             : r.id2             || null,
          nome            : r.nome,
          unidade         : r.unidade         || '',
          perfil          : r.perfil          || '',
          alocacao_total  : parseFloat(r.alocacao_total)   || 0,
          alocacao_projeto: parseFloat(r.alocacao_projeto) || 0,
          periodo_inicio  : r.periodo_inicio  || null,
          periodo_fim     : r.periodo_fim     || null,
          custo_hora      : r.custo_hora ? parseFloat(r.custo_hora) : null,
          notas           : r.notas           || '',
          sort_order      : i,
          updated_by      : self.currentUserId
        };
      });
      var res = await this.client.from('resources').insert(ins);
      if (res.error) throw res.error;
    },

    // ── Guardar entrada PDS (upsert por id0+id2) ──────────────
    savePDSEntry: async function (pdsObj) {
      var self = this;
      var payload = {
        id0                : pdsObj.id0   || '1',
        id1                : pdsObj.id1   || '',
        id2                : pdsObj.id2   || '',
        plano              : pdsObj.plano || '',
        n0                 : pdsObj.n0    || '',
        n1                 : pdsObj.n1    || '',
        compromissos_items : pdsObj.compromissos_items || [],
        avancos_items      : pdsObj.avancos_items      || [],
        proximos_items     : pdsObj.proximos_items     || [],
        atencao_items      : pdsObj.atencao_items      || [],
        compromissos       : pdsObj.compromissos,
        avancos            : pdsObj.avancos,
        proximos           : pdsObj.proximos,
        atencao            : pdsObj.atencao,
        updated_by         : this.currentUserId
      };

      var res = await this.client
        .from('pds_entries')
        .upsert(payload, { onConflict: 'id0,id2' })
        .select('id')
        .single();
      if (res.error) throw res.error;

      // Guardar _supabase_id no objecto em memória
      if (pdsObj && res.data) pdsObj._supabase_id = res.data.id;
      return res.data.id;
    },

    // ── Guardar riscos (full-replace por pds_id) ───────────────
    saveRisks: async function (pdsId, risks) {
      var self = this;
      if (!pdsId) return;

      var delRes = await this.client
        .from('risks')
        .delete()
        .eq('pds_id', pdsId);
      if (delRes.error) throw delRes.error;

      if (!risks || risks.length === 0) return;

      var rows = risks.map(function (r, i) {
        return {
          pds_id     : pdsId,
          description: r.desc       || '',
          impact     : r.impact     || 1,
          prob       : r.prob       || 1,
          status     : r.status     || 'Aberto',
          mitigation : r.mitigation || '',
          sort_order : i,
          updated_by : self.currentUserId
        };
      });

      var insRes = await this.client.from('risks').insert(rows);
      if (insRes.error) throw insRes.error;
    },

    // ── Guardar finanças (full-replace por pds_id) ─────────────
    saveFinances: async function (pdsId, finances) {
      var self = this;
      if (!pdsId) return;
      var fin = finances || {};

      // ─ Rubricas
      await this.client.from('fin_rubricas').delete().eq('pds_id', pdsId);
      var rubricas = fin.rubricas || [];
      if (rubricas.length > 0) {
        var rubRows = rubricas.map(function (r, i) {
          return {
            pds_id    : pdsId,
            app_id    : String(r.id || ''),
            categoria : r.categoria || '',
            capex     : !!r.capex,
            moeda     : r.moeda     || '€',
            valores   : r.valores   || {},
            nota      : r.nota      || null,
            fonte     : r.fonte     || null,
            sort_order: i,
            updated_by: self.currentUserId
          };
        });
        var rRes = await this.client.from('fin_rubricas').insert(rubRows);
        if (rRes.error) throw rRes.error;
      }

      // ─ Contratos
      await this.client.from('fin_contratos').delete().eq('pds_id', pdsId);
      var contratos = fin.contratos || [];
      if (contratos.length > 0) {
        var cntRows = contratos.map(function (c, i) {
          return {
            pds_id     : pdsId,
            app_id     : String(c.id || ''),
            fornecedor : c.fornecedor  || '',
            categoria  : c.categoria   || '',
            moeda      : c.moeda       || '€',
            cambio_ref : c.cambio_ref  || null,
            valor_total: c.valor_total || 0,
            data_adj   : c.data_adj    || null,
            descricao  : c.descricao   || '',
            sort_order : i,
            updated_by : self.currentUserId
          };
        });
        var cRes = await this.client.from('fin_contratos').insert(cntRows);
        if (cRes.error) throw cRes.error;
      }

      // ─ Facturas
      await this.client.from('fin_facturas').delete().eq('pds_id', pdsId);
      var facturas = fin.facturas || [];
      if (facturas.length > 0) {
        var fatRows = facturas.map(function (f, i) {
          return {
            pds_id          : pdsId,
            app_id          : String(f.id || ''),
            app_contrato_id : String(f.contrato_id || ''),
            ref             : f.ref             || '',
            fornecedor      : f.fornecedor       || '',
            doc_tipo        : f.doc_tipo         || null,
            descricao       : f.descricao        || '',
            valor           : f.valor            || 0,
            moeda           : f.moeda            || '€',
            cambio          : f.cambio           || null,
            data_emissao    : f.data_emissao     || null,
            data_vencimento : f.data_vencimento  || null,
            data_pagamento  : f.data_pagamento   || null,
            estado          : f.estado           || 'Por facturar',
            memorando       : f.memorando        || '',
            sort_order      : i,
            updated_by      : self.currentUserId
          };
        });
        var fRes = await this.client.from('fin_facturas').insert(fatRows);
        if (fRes.error) throw fRes.error;
      }
    },

    // ── Guardar snapshot ───────────────────────────────────────
    saveSnapshot: async function (snapObj) {
      var res = await this.client.from('snapshots').insert({
        label      : snapObj.label     || '',
        snap_date  : snapObj.timestamp || new Date().toISOString(),
        kpi        : snapObj.kpis      || {},
        by_n1      : snapObj.byN1      || {},
        by_n0      : snapObj.byN0      || {},
        created_by : this.currentUserId
      });
      if (res.error) throw res.error;
    },

    // ── Guardar configuração ───────────────────────────────────
    saveConfig: async function (cfgObj) {
      var res = await this.client
        .from('app_config')
        .upsert({ config_key: 'main', data: cfgObj, updated_by: this.currentUserId },
                 { onConflict: 'config_key' });
      if (res.error) throw res.error;
    },

    // ── Realtime: subscrever alterações ───────────────────────
    subscribeToChanges: function (onActivities, onPDS, onSnapshots) {
      if (!this.client) return;
      var self = this;
      this._channel = this.client
        .channel('pmo-realtime')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'activities' },
            function (payload) {
              if (payload.new && payload.new.updated_by === self.currentUserId) return;
              if (onActivities) onActivities(payload);
            })
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'pds_entries' },
            function (payload) {
              if (payload.new && payload.new.updated_by === self.currentUserId) return;
              if (onPDS) onPDS(payload);
            })
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'snapshots' },
            function (payload) {
              if (payload.new && payload.new.created_by === self.currentUserId) return;
              if (onSnapshots) onSnapshots(payload);
            })
        .subscribe();
    },

    unsubscribeAll: function () {
      if (this._channel) {
        this.client.removeChannel(this._channel);
        this._channel = null;
      }
    },

    // ── Histórico de alterações ────────────────────────────────
    getChangeLog: async function (tableFilter, limit) {
      var q = this.client
        .from('change_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit || 100);
      if (tableFilter) q = q.eq('table_name', tableFilter);
      var res = await q;
      if (res.error) throw res.error;
      return res.data;
    },

    // ── Gestão de utilizadores (admin) ─────────────────────────
    listUsers: async function () {
      var res = await this.client
        .from('user_metadata')
        .select('*, user_profiles(id, name)');
      if (res.error) throw res.error;
      return res.data;
    },

    listProfiles: async function () {
      var res = await this.client
        .from('user_profiles')
        .select('*')
        .order('name');
      if (res.error) throw res.error;
      return res.data;
    },

    saveProfile: async function (profileObj) {
      var payload = { name: profileObj.name, tabs: profileObj.tabs || {}, n0s: profileObj.n0s || [] };
      var res;
      if (profileObj._supabase_id) {
        res = await this.client
          .from('user_profiles')
          .update(payload)
          .eq('id', profileObj._supabase_id);
      } else {
        res = await this.client
          .from('user_profiles')
          .insert(payload)
          .select('id')
          .single();
        if (res.data) profileObj._supabase_id = res.data.id;
      }
      if (res.error) throw res.error;
    },

    deleteProfile: async function (profileId) {
      var res = await this.client
        .from('user_profiles')
        .delete()
        .eq('id', profileId);
      if (res.error) throw res.error;
    },

    // Criação/actualização de utilizadores via Edge Function
    // (a Edge Function usa service_role key para chamar auth.admin API)
    upsertUser: async function (userObj) {
      var res = await this.client.functions.invoke('upsert-user', {
        body: userObj
      });
      if (res.error) throw res.error;
      return res.data;
    },

    deleteUser: async function (userId) {
      var res = await this.client.functions.invoke('delete-user', {
        body: { user_id: userId }
      });
      if (res.error) throw res.error;
    }
  };

  window.SB = SB;

})();

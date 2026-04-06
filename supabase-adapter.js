/**
 * supabase-adapter.js — Strategos PMO
 *
 * Supabase adapter exposing window.SB.
 * Include AFTER the Supabase CDN script:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="supabase-adapter.js"></script>
 *
 * Set SUPABASE_URL and SUPABASE_ANON_KEY before loading this file.
 *
 * Translation boundary: DB columns are English; JS app properties remain in
 * Portuguese. The _map* functions handle the translation layer.
 */

(function () {
  'use strict';

  var SUPABASE_URL      = window.SUPABASE_URL      || '';
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  var SB = {
    client        : null,
    isOnline      : false,
    currentUserId : null,
    _channel      : null,

    // ── Initialisation ─────────────────────────────────────────
    init: async function () {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[SB] SUPABASE_URL or SUPABASE_ANON_KEY not set. Using local mode.');
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
        console.warn('[SB] Supabase unavailable, falling back to localStorage.', e);
        this.isOnline = false;
      }
    },

    // ── Authentication ─────────────────────────────────────────
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

    getUserMeta: async function (userId) {
      var res = await this.client
        .from('user_metadata')
        .select('*, user_profiles(*)')
        .eq('id', userId)
        .single();
      if (res.error) throw res.error;
      return res.data;
    },

    // ── Internal mapping: DB row → app object ──────────────────
    // DB columns are English; app (JS) properties remain Portuguese.

    _mapActivity: function (row) {
      return {
        nivel    : row.level,
        nome     : row.name,
        n0       : row.n0      || '',
        n1       : row.n1      || '',
        n2       : row.n2      || '',
        n3       : row.n3      || '',
        n4       : row.n4      || '',
        n5       : row.n5      || '',
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
            desc         : r.description || '',
            impact       : r.impact,
            prob         : r.probability,
            status       : r.status,
            mitigation   : r.mitigation || '',
            _supabase_id : r.id
          };
        });

      var rubricas = (row.fin_budget_lines || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (r) {
          return {
            id           : r.app_id || r.id,
            categoria    : r.category,
            capex        : r.capex,
            moeda        : r.currency,
            valores      : r.values    || {},
            nota         : r.note      || '',
            fonte        : r.source_ref || '',
            _supabase_id : r.id
          };
        });

      var contratos = (row.fin_contracts || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (c) {
          return {
            id           : c.app_id || c.id,
            fornecedor   : c.supplier       || '',
            categoria    : c.category       || '',
            moeda        : c.currency       || '€',
            cambio_ref   : c.exchange_rate_ref,
            valor_total  : c.total_amount   || 0,
            data_adj     : c.award_date,
            descricao    : c.description    || '',
            _supabase_id : c.id
          };
        });

      var facturas = (row.fin_invoices || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (f) {
          return {
            id              : f.app_id || f.id,
            contrato_id     : f.app_contract_id  || '',
            ref             : f.ref              || '',
            fornecedor      : f.supplier         || '',
            doc_tipo        : f.doc_type,
            descricao       : f.description      || '',
            valor           : f.amount           || 0,
            moeda           : f.currency         || '€',
            cambio          : f.exchange_rate,
            data_emissao    : f.issue_date,
            data_vencimento : f.due_date,
            data_pagamento  : f.payment_date,
            estado          : f.status           || 'Por facturar',
            memorando       : f.memo             || '',
            _supabase_id    : f.id
          };
        });

      return {
        id0                : row.id0       || '1',
        id1                : row.id1       || '',
        id2                : row.id2       || '',
        plano              : row.plan_name || '',
        n0                 : row.n0        || '',
        n1                 : row.n1        || '',
        compromissos_items : row.commitments_items  || [],
        avancos_items      : row.progress_items     || [],
        proximos_items     : row.next_steps_items   || [],
        atencao_items      : row.attention_items    || [],
        compromissos       : row.commitments,
        avancos            : row.progress,
        proximos           : row.next_steps,
        atencao            : row.attention,
        risks              : risks,
        finances           : {
          rubricas : rubricas,
          contratos: contratos,
          facturas : facturas
        },
        fte                : {
          dias_uteis : row.fte_working_days || 22,
          recursos   : (row.fte_resources || [])
            .sort(function (a, b) { return a.sort_order - b.sort_order; })
            .map(function (r) {
              return {
                id           : r.app_id || r.id,
                nome         : r.name          || '',
                unidade      : r.org_unit       || '',
                perfil       : r.role           || '',
                tipo         : r.type           || 'interno',
                custo_dia    : Number(r.daily_cost)     || 0,
                id2          : r.id2            || '',
                data_inicio  : r.start_date     || null,
                data_fim     : r.end_date       || null,
                alocacao_pct : Number(r.allocation_pct) || 100,
                contrato_id  : r.contract_id    || '',
                estado       : r.status         || 'activo',
                _supabase_id : r.id
              };
            })
        },
        _supabase_id : row.id
      };
    },

    _mapResource: function (r) {
      return {
        _supabase_id    : r.id,
        id0             : r.id0,
        id1             : r.id1          || null,
        id2             : r.id2          || null,
        nome            : r.name,
        unidade         : r.org_unit     || '',
        perfil          : r.role         || '',
        alocacao_total  : Number(r.total_hours)   || 0,
        alocacao_projeto: Number(r.project_hours) || 0,
        periodo_inicio  : r.period_start || null,
        periodo_fim     : r.period_end   || null,
        custo_hora      : r.hourly_cost != null ? Number(r.hourly_cost) : null,
        notas           : r.notes        || '',
        sort_order      : r.sort_order   || 0
      };
    },

    _mapPessoa: function (row) {
      return {
        id       : row.id,
        nome     : row.name     || '',
        email    : row.email    || '',
        unidade  : row.org_unit || '',
        perfil   : row.role     || '',
        tipo     : row.type     || 'interno',
        notas    : row.notes    || '',
        activo   : row.active   !== false,
        sort_order: row.sort_order || 0
      };
    },

    // ── Load data ──────────────────────────────────────────────

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
        .select('*, risks(*), fin_budget_lines(*), fin_contracts(*), fin_invoices(*), fte_resources(*)')
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
          timestamp    : s.snap_date,
          label        : s.label,
          kpis         : s.kpi   || {},
          byN1         : s.by_n1 || {},
          byN0         : s.by_n0 || {},
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

    loadResources: async function (id0s) {
      var q = this.client.from('resources').select('*').order('sort_order');
      if (id0s && id0s.length) q = q.in('id0', id0s);
      var res = await q;
      if (res.error) throw res.error;
      return (res.data || []).map(function (r) { return SB._mapResource(r); });
    },

    // ── Save activities (full-replace by id0) ──────────────────
    saveActivities: async function (ganttRows) {
      var self = this;
      var rows = ganttRows.map(function (r, i) {
        return {
          source    : 'gantt',
          level     : r.nivel,
          name      : r.nome      || '',
          n0        : r.n0        || '',
          n1        : r.n1        || '',
          n2        : r.n2        || '',
          n3        : r.n3        || '',
          n4        : r.n4        || '',
          n5        : r.n5        || '',
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

      var id0sToReplace = [...new Set(rows.map(function(r){ return r.id0; }))];
      for (var j = 0; j < id0sToReplace.length; j++) {
        var delRes = await this.client
          .from('activities')
          .delete()
          .eq('source', 'gantt')
          .eq('id0', id0sToReplace[j]);
        if (delRes.error) throw delRes.error;
      }

      for (var i = 0; i < rows.length; i += 500) {
        var chunk = rows.slice(i, i + 500);
        var insRes = await this.client.from('activities').insert(chunk);
        if (insRes.error) throw insRes.error;
      }
    },

    saveResources: async function (id0, rows) {
      var del = await this.client.from('resources').delete().eq('id0', id0);
      if (del.error) throw del.error;
      if (!rows || !rows.length) return;
      var self = this;
      var ins = rows.map(function (r, i) {
        return {
          id0          : id0,
          id1          : r.id1          || null,
          id2          : r.id2          || null,
          name         : r.nome,
          org_unit     : r.unidade      || '',
          role         : r.perfil       || '',
          total_hours  : parseFloat(r.alocacao_total)   || 0,
          project_hours: parseFloat(r.alocacao_projeto) || 0,
          period_start : r.periodo_inicio || null,
          period_end   : r.periodo_fim    || null,
          hourly_cost  : r.custo_hora ? parseFloat(r.custo_hora) : null,
          notes        : r.notas         || '',
          sort_order   : i,
          updated_by   : self.currentUserId
        };
      });
      var res = await this.client.from('resources').insert(ins);
      if (res.error) throw res.error;
    },

    // ── Save PDS entry (upsert by id0+id2) ─────────────────────
    savePDSEntry: async function (pdsObj) {
      var payload = {
        id0               : pdsObj.id0    || '1',
        id1               : pdsObj.id1    || '',
        id2               : pdsObj.id2    || '',
        plan_name         : pdsObj.plano  || '',
        n0                : pdsObj.n0     || '',
        n1                : pdsObj.n1     || '',
        commitments_items : pdsObj.compromissos_items || [],
        progress_items    : pdsObj.avancos_items      || [],
        next_steps_items  : pdsObj.proximos_items     || [],
        attention_items   : pdsObj.atencao_items      || [],
        commitments       : pdsObj.compromissos,
        progress          : pdsObj.avancos,
        next_steps        : pdsObj.proximos,
        attention         : pdsObj.atencao,
        fte_working_days  : (pdsObj.fte && pdsObj.fte.dias_uteis) ? Number(pdsObj.fte.dias_uteis) : 22,
        updated_by        : this.currentUserId
      };

      var res = await this.client
        .from('pds_entries')
        .upsert(payload, { onConflict: 'id0,id2' })
        .select('id')
        .single();
      if (res.error) throw res.error;

      if (pdsObj && res.data) pdsObj._supabase_id = res.data.id;
      return res.data.id;
    },

    // ── Save risks (full-replace by pds_id) ────────────────────
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
          pds_id      : pdsId,
          description : r.desc        || '',
          impact      : r.impact      || 1,
          probability : r.prob        || 1,
          status      : r.status      || 'Aberto',
          mitigation  : r.mitigation  || '',
          sort_order  : i,
          updated_by  : self.currentUserId
        };
      });

      var insRes = await this.client.from('risks').insert(rows);
      if (insRes.error) throw insRes.error;
    },

    // ── Save finances (full-replace by pds_id) ─────────────────
    saveFinances: async function (pdsId, finances) {
      var self = this;
      if (!pdsId) return;
      var fin = finances || {};

      // ─ Budget lines
      await this.client.from('fin_budget_lines').delete().eq('pds_id', pdsId);
      var rubricas = fin.rubricas || [];
      if (rubricas.length > 0) {
        var rubRows = rubricas.map(function (r, i) {
          return {
            pds_id    : pdsId,
            app_id    : String(r.id || ''),
            category  : r.categoria || '',
            capex     : !!r.capex,
            currency  : r.moeda     || '€',
            values    : r.valores   || {},
            note      : r.nota      || null,
            source_ref: r.fonte     || null,
            sort_order: i,
            updated_by: self.currentUserId
          };
        });
        var rRes = await this.client.from('fin_budget_lines').insert(rubRows);
        if (rRes.error) throw rRes.error;
      }

      // ─ Contracts
      await this.client.from('fin_contracts').delete().eq('pds_id', pdsId);
      var contratos = fin.contratos || [];
      if (contratos.length > 0) {
        var cntRows = contratos.map(function (c, i) {
          return {
            pds_id           : pdsId,
            app_id           : String(c.id || ''),
            supplier         : c.fornecedor    || '',
            category         : c.categoria     || '',
            currency         : c.moeda         || '€',
            exchange_rate_ref: c.cambio_ref     || null,
            total_amount     : c.valor_total    || 0,
            award_date       : c.data_adj       || null,
            description      : c.descricao      || '',
            sort_order       : i,
            updated_by       : self.currentUserId
          };
        });
        var cRes = await this.client.from('fin_contracts').insert(cntRows);
        if (cRes.error) throw cRes.error;
      }

      // ─ Invoices
      await this.client.from('fin_invoices').delete().eq('pds_id', pdsId);
      var facturas = fin.facturas || [];
      if (facturas.length > 0) {
        var fatRows = facturas.map(function (f, i) {
          return {
            pds_id          : pdsId,
            app_id          : String(f.id || ''),
            app_contract_id : String(f.contrato_id || ''),
            ref             : f.ref              || '',
            supplier        : f.fornecedor        || '',
            doc_type        : f.doc_tipo          || null,
            description     : f.descricao         || '',
            amount          : f.valor             || 0,
            currency        : f.moeda             || '€',
            exchange_rate   : f.cambio            || null,
            issue_date      : f.data_emissao      || null,
            due_date        : f.data_vencimento   || null,
            payment_date    : f.data_pagamento    || null,
            status          : f.estado            || 'Por facturar',
            memo            : f.memorando         || '',
            sort_order      : i,
            updated_by      : self.currentUserId
          };
        });
        var fRes = await this.client.from('fin_invoices').insert(fatRows);
        if (fRes.error) throw fRes.error;
      }
    },

    // ── Save snapshot ──────────────────────────────────────────
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

    // ── Save config ────────────────────────────────────────────
    saveConfig: async function (cfgObj) {
      var res = await this.client
        .from('app_config')
        .upsert({ config_key: 'main', data: cfgObj, updated_by: this.currentUserId },
                 { onConflict: 'config_key' });
      if (res.error) throw res.error;
    },

    // ── Realtime subscriptions ─────────────────────────────────
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

    // ── Save FTE resources (full-replace by pds_id) ────────────
    saveFte: async function (pdsId, recursos) {
      var self = this;
      if (!pdsId) return;

      var delRes = await this.client
        .from('fte_resources')
        .delete()
        .eq('pds_id', pdsId);
      if (delRes.error) throw delRes.error;

      var rows = (recursos || []).filter(function (r) { return r.nome && r.nome.trim(); });
      if (!rows.length) return;

      var insRows = rows.map(function (r, i) {
        return {
          pds_id        : pdsId,
          app_id        : String(r.id || ''),
          name          : r.nome          || '',
          org_unit      : r.unidade       || '',
          role          : r.perfil        || '',
          type          : r.tipo          || 'interno',
          daily_cost    : parseFloat(r.custo_dia)     || 0,
          id2           : r.id2           || '',
          start_date    : r.data_inicio   || null,
          end_date      : r.data_fim      || null,
          allocation_pct: parseFloat(r.alocacao_pct)  || 100,
          contract_id   : r.contrato_id   || '',
          status        : r.estado        || 'activo',
          sort_order    : i,
          updated_by    : self.currentUserId
        };
      });

      var insRes = await this.client.from('fte_resources').insert(insRows);
      if (insRes.error) throw insRes.error;
    },

    // ── Load FTE for a specific pds_id ─────────────────────────
    loadFteForPDS: async function (pdsId) {
      if (!pdsId) return { recursos: [], dias_uteis: 22 };

      var pdsRes = await this.client
        .from('pds_entries')
        .select('fte_working_days, fte_resources(*)')
        .eq('id', pdsId)
        .single();
      if (pdsRes.error) throw pdsRes.error;

      var row = pdsRes.data || {};
      var recursos = (row.fte_resources || [])
        .sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (r) {
          return {
            id           : r.app_id || r.id,
            nome         : r.name          || '',
            unidade      : r.org_unit      || '',
            perfil       : r.role          || '',
            tipo         : r.type          || 'interno',
            custo_dia    : Number(r.daily_cost)     || 0,
            id2          : r.id2           || '',
            data_inicio  : r.start_date    || null,
            data_fim     : r.end_date      || null,
            alocacao_pct : Number(r.allocation_pct) || 100,
            contrato_id  : r.contract_id   || '',
            estado       : r.status        || 'activo',
            _supabase_id : r.id
          };
        });

      return { recursos: recursos, dias_uteis: row.fte_working_days || 22 };
    },

    unsubscribeAll: function () {
      if (this._channel) {
        this.client.removeChannel(this._channel);
        this._channel = null;
      }
    },

    // ── Change log ─────────────────────────────────────────────
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

    // ── User management (admin) ────────────────────────────────
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

    // User creation/update via Edge Function
    // (Edge Function uses service_role key to call auth.admin API)
    upsertUser: async function (userObj) {
      var res = await this.client.functions.invoke('upsert-user', { body: userObj });
      if (res.error) throw res.error;
      return res.data;
    },

    deleteUser: async function (userId) {
      var res = await this.client.functions.invoke('delete-user', { body: { user_id: userId } });
      if (res.error) throw res.error;
    },

    // ── People catalogue ───────────────────────────────────────
    loadPessoas: async function () {
      if (!this.isOnline) return [];
      var self = this;
      var res = await this.client
        .from('people')
        .select('*')
        .order('name');
      if (res.error) throw res.error;
      return (res.data || []).map(function (row) { return self._mapPessoa(row); });
    },

    savePessoa: async function (p) {
      var payload = {
        name      : p.nome     || '',
        email     : p.email    || '',
        org_unit  : p.unidade  || '',
        role      : p.perfil   || '',
        type      : p.tipo     || 'interno',
        notes     : p.notas    || '',
        active    : p.activo   !== false,
        sort_order: p.sort_order || 0,
        updated_by: this.currentUserId
      };
      if (p.id) {
        var res = await this.client.from('people').update(payload).eq('id', p.id).select('id').single();
        if (res.error) throw res.error;
        return res.data.id;
      }
      var res = await this.client.from('people').insert(payload).select('id').single();
      if (res.error) throw res.error;
      return res.data.id;
    },

    deletePessoa: async function (id) {
      var res = await this.client.from('people').delete().eq('id', id);
      if (res.error) throw res.error;
    }
  };

  window.SB = SB;

})();

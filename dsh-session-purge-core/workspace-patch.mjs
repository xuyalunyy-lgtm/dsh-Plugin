function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('Workspace purge baseline mismatch');return source.replace(before,after);}
export function patchWorkspace(source){
 source=replaceOnce(source,'static inject = ["storageDomain", "sessionPersistence"];','static inject = ["storageDomain", "sessionPersistence", "sessions", "sessionQuery", "sessionProjectionCache"];');
 source=replaceOnce(source,'\t\tthis.reportFilteredCandidates();','\t\tthis.reportFilteredCandidates();\n\t\tfor (const entry of await this.ctx.sessionPersistence.purgeEntries()) {\n\t\t\tawait this.purgeArchivedSession(entry.request);\n\t\t}');
 return replaceOnce(source,'\tunarchiveSession(sessionId) {',String.raw`
  purgeArchivedSession(request) {
    return this.enqueueOperation(async () => {
      const refuse=(code,message)=>{throw Object.assign(new Error(message),{code,purgeCommitted:false});};
      if(!request || Object.keys(request).some(k=>!['sessionId','requestId','expectedRevision'].includes(k)) || ['sessionId','requestId','expectedRevision'].some(k=>typeof request[k]!=='string'||!request[k]||request[k].length>256||/[\u0000-\u001f]/.test(request[k])) || request.requestId.length<16 || request.requestId.length>128)refuse('PURGE_INVALID_REQUEST','永久删除请求无效。');
      const {sessionId}=request;
      const persistence=this.ctx.sessionPersistence;
      const sessions=this.ctx.get('sessions'), agents=this.ctx.get('agents');
      const query=this.ctx.get('sessionQuery'), projections=this.ctx.get('sessionProjectionCache');
      if(!sessions?.reservePurge||!persistence.reservePurge||!query?.purgeSessionData||!projections?.purgeSessionData)refuse('PURGE_UNSUPPORTED','宿主永久删除组件尚未全部就绪。');
      let lease,gate,committed=true;
      try {
        const known=await persistence.purgeStatus(request);
        committed=!!known;
        if(known && !sessions.purgeReservations.has(sessionId)) {
          gate=sessions.reservePurge(sessionId);
          gate.release({purgeCommitted:true});
        }
        if(!known){
          query.assertPurgeSupported();
          if(!this.requireState().archivedSessionIds.includes(sessionId))refuse('PURGE_NOT_ARCHIVED','只能永久删除已归档会话。');
          gate=sessions.reservePurge(sessionId,{allowLoaded:true});
          if(agents?.get(sessionId)) {
            const loop=this.ctx.get('agentLoop');
            if(!loop?.releaseIdleForPurge)refuse('PURGE_UNSUPPORTED','空闲会话释放组件未就绪。');
            await loop.releaseIdleForPurge(sessionId);
          }
          if(sessions.get(sessionId))refuse('PURGE_LIVE_SESSION','此会话由其他组件持有，无法正常释放。');
          const activity=await this.ctx.waterfall('workspace/session-activity',{sessionId},()=>Promise.resolve([]));
          if(activity.length)refuse('PURGE_SESSION_BUSY','会话仍有运行或排队任务。');
        }
        lease=await persistence.reservePurge(request);
        const receipt=await lease.read(); committed=!!receipt;
        if(!receipt){
          const own=await persistence.stat(sessionId);
          if(own?.header.origin==='subagent')refuse('PURGE_REFERENCED','子智能体会话不能单独永久删除。');
          const rows=await persistence.list();
          if(rows.some(row=>row.header.parentSession===sessionId))refuse('PURGE_REFERENCED','其他会话仍继承此会话，请先处理关联会话。');
          committed=true;
          try{await lease.begin();}catch(error){if(error.purgeCommitted===false)committed=false;throw error;}
        }
        await lease.remove();
        for(const workspace of this.entities.values())await workspace.detachSession(sessionId);
        const state=this.requireState();
        await this.setState({...state,archivedSessionIds:state.archivedSessionIds.filter(id=>id!==sessionId),pinnedSessionIds:state.pinnedSessionIds.filter(id=>id!==sessionId)});
        this.headers.delete(sessionId);this.sessionPaths.delete(sessionId);this.missingSessionPaths.delete(sessionId);this.invalidSessionPaths.delete(sessionId);
        await query.purgeSessionData(sessionId);
        await projections.purgeSessionData(sessionId);
        await lease.complete();
        return {sessionId,requestId:request.requestId,revision:request.expectedRevision,status:'deleted'};
      } catch(error){error.purgeCommitted=committed||error.purgeCommitted===true;throw error;}
      finally {try{await lease?.release();}finally{gate?.release({purgeCommitted:committed});}}
    });
  }
\tunarchiveSession(sessionId) {`.replace('\\tunarchiveSession','\tunarchiveSession'));
}

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../supabase');
const { awardKarma, getUserProfile, getKarmaLevel } = require('../services/karmaService');
const { parseLocation } = require('../geo');

const DEMO_REQUESTS = [
  { id: 'demo-1', title: 'Help carrying groceries upstairs', description: 'Two heavy bags, third floor, no lift.', status: 'open', category: 'Errands', lat: 28.6139, lng: 77.2090, username: 'Asha', karma_points: 120 },
  { id: 'demo-2', title: 'Locked out - need a spare key run', description: 'Roommate has the spare, can someone drive me 10 mins?', status: 'open', category: 'Urgent', lat: 28.6200, lng: 77.2150, username: 'Ravi', karma_points: 260 },
  { id: 'demo-3', title: 'Move a small sofa', description: 'Need one extra pair of hands this Saturday.', status: 'accepted', category: 'Moving', lat: 28.6080, lng: 77.2000, username: 'Meera', karma_points: 45 },
  { id: 'demo-4', title: 'Fix a leaking kitchen tap', description: 'Have the parts, need someone who knows plumbing.', status: 'open', category: 'Repairs', lat: 28.6180, lng: 77.2030, username: 'Kabir', karma_points: 520 }
];

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    database: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY) ? 'configured' : 'not configured (demo mode)'
  });
});

router.get('/requests', async (req, res) => {
  const configured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
  const withLevel = (r) => ({ ...r, karmaLevel: getKarmaLevel(r.karma_points || 0) });

  if (!configured) {
    return res.json({ demo: true, requests: DEMO_REQUESTS.map(withLevel) });
  }

  try {
    const { data, error } = await getSupabase()
      .from('help_requests')
      .select('id,title,description,status,category,location,created_at,profiles:user_id(username,karma_points)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const requests = (data || []).map((r) => {
      const pos = parseLocation(r.location) || {};
      return withLevel({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        category: r.category,
        created_at: r.created_at,
        lat: pos.lat,
        lng: pos.lng,
        username: r.profiles?.username || 'Neighbor',
        karma_points: r.profiles?.karma_points || 0
      });
    });
    res.json({ demo: false, requests });
  } catch (error) {
    console.error('List requests error:', error);
    // Stay functional: fall back to demo data and say why.
    res.json({ demo: true, warning: error.message, requests: DEMO_REQUESTS.map(withLevel) });
  }
});

router.post('/complete-task', async (req, res) => {
  const { requestId, helperId } = req.body;

  if (!requestId || !helperId) {
    return res.status(400).json({ error: 'Missing required fields: requestId, helperId' });
  }

  try {
    const { data: request, error: requestError } = await getSupabase()
      .from('help_requests')
      .select('*, profiles:user_id(karma_points)')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status === 'completed') {
      return res.status(400).json({ error: 'Task already completed' });
    }

    if (request.helper_id !== helperId && request.user_id !== helperId) {
      return res.status(403).json({ error: 'Not authorized to complete this task' });
    }

    const karmaResult = await awardKarma(helperId, 50);
    
    if (!karmaResult.success) {
      throw new Error(karmaResult.error);
    }

    const { error: updateError } = await getSupabase()
      .from('help_requests')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    const updatedProfile = await getUserProfile(helperId);

    res.json({
      success: true,
      message: 'Task completed successfully!',
      karmaAwarded: 50,
      totalKarma: updatedProfile.data?.karma_points || 0,
      karmaLevel: getKarmaLevel(updatedProfile.data?.karma_points || 0)
    });

  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete task' });
  }
});

router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await getUserProfile(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({
      ...result.data,
      karmaLevel: getKarmaLevel(result.data.karma_points || 0)
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/karma-level/:points', (req, res) => {
  const points = parseInt(req.params.points) || 0;
  res.json({
    level: getKarmaLevel(points),
    points: points
  });
});

router.post('/karma/award', async (req, res) => {
  const { targetUserId, amount, reason } = req.body;

  if (!targetUserId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await awardKarma(targetUserId, amount);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      message: reason || `Awarded ${amount} karma points`,
      pointsAwarded: amount
    });

  } catch (error) {
    console.error('Award karma error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

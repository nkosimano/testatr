import { handler } from '../generate-bracket/index';
import { createClient } from '@supabase/supabase-js';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('GenerateBracketFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should generate a bracket for a valid tournament', async () => {
    const mockTournament = { id: 'tourney1', status: 'registration_closed', format: 'single_elimination', start_date: new Date().toISOString() };
    const mockParticipants = [
      { id: 'p1', player: { user_id: 'user1', elo_rating: 1500 } },
      { id: 'p2', player: { user_id: 'user2', elo_rating: 1400 } },
      { id: 'p3', player: { user_id: 'user3', elo_rating: 1300 } },
      { id: 'p4', player: { user_id: 'user4', elo_rating: 1200 } },
    ];
    
    mockSupabase.single.mockResolvedValue({ data: mockTournament, error: null });
    mockSupabase.select.mockResolvedValue({ data: mockParticipants, error: null });
    // Mock the update call for seeding
    mockSupabase.update.mockResolvedValue({ error: null });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'tourney1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.matchesCreated).toBeGreaterThan(0);
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'in_progress' });
  });

  it('should return a 400 error if tournament status is not registration_closed', async () => {
    const mockTournament = { id: 'tourney1', status: 'registration_open' };
    mockSupabase.single.mockResolvedValue({ data: mockTournament, error: null });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'tourney1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("Tournament must be in 'registration_closed' status");
  });

  it('should return a 404 error if tournament is not found', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'nonexistent' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Tournament not found');
  });
});

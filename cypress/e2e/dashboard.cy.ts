describe('Dashboard', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          },
          profile: {
            user_id: 'test-user-id',
            username: 'testuser',
            elo_rating: 1200,
            matches_played: 0,
            matches_won: 0
          },
          session: {
            access_token: 'mock-token'
          }
        },
        version: 0
      }))
    })
  })

  it('should display dashboard when authenticated', () => {
    cy.visit('/dashboard')
    cy.contains('Welcome, testuser!').should('be.visible')
    cy.contains('ELO Rating: 1200').should('be.visible')
  })

  it('should allow user to sign out', () => {
    cy.visit('/dashboard')
    cy.contains('Sign Out').click()
    cy.url().should('include', '/login')
  })

  it('should display user statistics', () => {
    cy.visit('/dashboard')
    cy.contains('Matches Played: 0').should('be.visible')
    cy.contains('Matches Won: 0').should('be.visible')
  })
})
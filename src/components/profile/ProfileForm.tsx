import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Camera, Save, X } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../LoadingSpinner'
import type { Database } from '../../types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  bio: z.string().max(200, 'Bio must be less than 200 characters').optional(),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
})

type ProfileFormData = z.infer<typeof profileSchema>

export const ProfileForm: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const profile = useAuthStore(state => state.profile)
  const updateProfile = useAuthStore(state => state.updateProfile)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || '',
      bio: profile?.bio || '',
      skill_level: profile?.skill_level || 'beginner',
    }
  })

  const watchedBio = watch('bio') || '';

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    
    try {
      await updateProfile(data)
      setSuccessMessage('Profile updated successfully')
      reset(data) // Reset form with new values
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setIsUploading(true)
    setErrorMessage(null)
    
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.user_id}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `profile-pictures/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new picture URL
      await updateProfile({ profile_picture_url: publicUrl })
      setSuccessMessage('Profile picture updated successfully')
    } catch (err: any) {
      setErrorMessage('Error uploading profile picture: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner 
          size="large" 
          text="Loading profile..." 
          subtext="Retrieving your profile information"
        />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-header-info">
              <h1>Profile Settings</h1>
              <p>Manage your personal information and preferences</p>
            </div>
            
            {successMessage && (
              <div className="profile-success-message">
                <div className="profile-success-content">
                  <Save size={20} />
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-6">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="profile-main-content">
            {/* Profile Picture */}
            <div className="profile-picture-section">
              <div className="profile-picture-container">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.username}
                    className="profile-picture"
                  />
                ) : (
                  <div className="profile-picture-placeholder">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <label
                  htmlFor="profile-picture"
                  className="profile-picture-edit"
                >
                  <Camera size={20} />
                </label>
                <input
                  type="file"
                  id="profile-picture"
                  accept="image/*"
                  className="profile-hidden-input"
                  onChange={handleProfilePictureChange}
                  disabled={isUploading}
                />
              </div>
              {isUploading && (
                <div className="mt-2 text-sm text-gray-600 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Uploading...
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="profile-form">
              {/* Username */}
              <div className="profile-form-group">
                <label htmlFor="username" className="profile-form-label">
                  <User size={16} className="inline mr-1" />
                  Username
                </label>
                <input
                  {...register('username')}
                  type="text"
                  id="username"
                  className="profile-form-input"
                  placeholder="Choose a username"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              {/* Skill Level */}
              <div className="profile-form-group">
                <label htmlFor="skill_level" className="profile-form-label">
                  Skill Level
                </label>
                <select
                  {...register('skill_level')}
                  id="skill_level"
                  className="profile-form-input"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                {errors.skill_level && (
                  <p className="mt-1 text-sm text-red-600">{errors.skill_level.message}</p>
                )}
              </div>

              {/* Bio */}
              <div className="profile-form-group">
                <label htmlFor="bio" className="profile-form-label">
                  Bio
                </label>
                <textarea
                  {...register('bio')}
                  id="bio"
                  rows={4}
                  className="profile-form-textarea"
                  placeholder="Tell others about yourself..."
                />
                {errors.bio && (
                  <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {watchedBio.length}/200 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="profile-actions">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="profile-cancel-btn"
                  disabled={isSubmitting || !isDirty}
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="profile-save-btn"
                >
                  {isSubmitting ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
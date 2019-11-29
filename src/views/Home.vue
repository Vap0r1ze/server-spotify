<template>
  <div class="home">
    <div class="feed" v-if="ready">
      <User v-for="userId in userIds" :key="userId" :userId="userId"/>
    </div>
  </div>
</template>

<script>
import { queue } from 'async'
import { mapState } from 'vuex'
import { spotify, vapi } from '../api.js'
import User from '@/components/User.vue'

let cachedTracks = []

export default {
  name: 'Home',
  components: {
    User
  },
  data() {
    return {
      userIds: [],
      ready: false,
      tracksQueue: queue(this.tracksHandler, 2)
    }
  },
  computed: {
    ...mapState(['tracks', 'users'])
  },
  methods: {
    refreshData() {
      let firstTrack
      return vapi
        .getData('/dspotify')
        .then(userIds => {
          if (this.userIds.length !== userIds.length) this.userIds = userIds
          let usersCache = {}
          return vapi
            .getMultiData('/dspotify', userIds)
            .then(users => {
              const trackIds = []
              const trackIdBuckets = []
              for (const userId of userIds) {
                const lastActivity =
                  users[userId].activity[users[userId].activity.length - 1]
                const lastListen =
                  !lastActivity || !lastActivity.t
                    ? null
                    : lastActivity.s + lastActivity.t
                usersCache[userId] = {
                  ...users[userId],
                  lastListen
                }
                for (const track of users[userId].activity) {
                  if (
                    !trackIds.includes(track.id) &&
                    !(track.id in this.tracks)
                  )
                    trackIds.push(track.id)
                }
              }
              if (trackIds.length) {
                for (let i = 0; i < trackIds.length; i++) {
                  if (i % 50 === 0) trackIdBuckets.unshift([])
                  trackIdBuckets[0].push(trackIds[i])
                }
                firstTrack = trackIdBuckets[0][0]
                this.tracksQueue.push(trackIdBuckets)
                return this.tracksQueue.drain()
              }
            })
            .then(() => {
              this.$store.dispatch('saveTracks', cachedTracks)
              for (const [userId, data] of Object.entries(usersCache))
                this.$store.dispatch('updateUser', { userId, data })
              this.$store.dispatch('reinitUsers')
              cachedTracks = []
              usersCache = []
            })
            .catch(error => {
              console.error(error)
            })
        })
        .catch(error => {
          console.error(error)
        })
    },
    sortUsers() {
      const { users } = this
      const listening = []
      const notListening = []
      for (const userId of this.userIds) {
        if (users[userId].lastListen == null) listening.push(userId)
        else notListening.push(userId)
      }
      listening.sort((a, b) => {
        if (users[a].member.username.toLowerCase() > users[b].member.username.toLowerCase()) return 1
        if (users[a].member.username.toLowerCase() < users[b].member.username.toLowerCase()) return -1
        return 0
      })
      notListening.sort((a, b) => {
        if (users[a].lastListen > users[b].lastListen) return -1
        if (users[a].lastListen < users[b].lastListen) return 1
        return 0
      })
      this.userIds = listening.concat(notListening)
    },
    tracksHandler(trackIds, callback) {
      if (trackIds.length > 50) {
        const extraTrackIds = trackIds.slice(50)
        trackIds = trackIds.slice(0, 50)
        this.tracksQueue.push([extraTrackIds])
      }
      spotify
        .getTracks(trackIds)
        .then(({ tracks }) => {
          cachedTracks.push(...tracks)
          callback()
        })
        .catch(error => {
          console.error(error)
        })
    },
    dataInterval() {
      setTimeout(() => {
        this.refreshData().then(() => {
          this.dataInterval()
        })
      }, 1000)
    }
  },
  created() {
    this.refreshData().then(() => {
      this.ready = true
      this.dataInterval()
    })
    this.$store.subscribe((mutation, payload) => {
      if (mutation.type === 'reinitUsers')
        this.sortUsers()
    })
  }
}
</script>

<style>
.home {
  align-items: center;
  background: #121212;
  display: flex;
  flex-direction: column;
  padding: 48px;
}
.feed {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  width: 400px;
}
.feed > .user {
  margin-bottom: 36px;
}
</style>

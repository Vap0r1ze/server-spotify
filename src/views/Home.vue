<template>
  <div class="home">
    <div class="feed" v-if="ready">
      <DynamicScroller
        :items="userIds"
        :min-item-size="36"
        class="scroller"
      >
        <template v-slot="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :data-index="index"
          >
            <User :userId="item"/>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
    </div>
    <div class="splash" v-else>
      <div class="progress-desc">{{ loadingData.desc }}</div>
      <div class="progress-bar">
        <div
          class="progress"
          :style="{
            width: `${Math.max(Math.round(loadingData.complete / loadingData.total * 100), 2)}%`
          }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script>
import { queue } from 'async'
import { mapState } from 'vuex'
import { spotify, vapi } from '../api.js'
import User from '@/components/User.vue'

let cachedTracks = []
let cachedUsers = {}

export default {
  name: 'Home',
  components: {
    User
  },
  data() {
    return {
      userIds: [],
      ready: false,
      tracksQueue: queue(this.tracksHandler, 2),
      loadingData: {
        total: 1,
        complete: 0,
        desc: ''
      }
    }
  },
  computed: {
    ...mapState(['tracks', 'users'])
  },
  methods: {
    refreshData() {
      if (!this.ready) {
        this.loadingData.total = 1
        this.loadingData.completed = 0
        this.loadingData.desc = 'Grabbing User Data'
      }
      let userIds
      return vapi
        .getMultiData('/dspotify', [ '*' ])
        .then(users => {
          userIds = Object.keys(users)
          const trackIds = []
          const trackIdBuckets = []
          for (const userId of userIds) {
            if (!(userId in users)) continue
            const lastActivity =
              users[userId].activity[users[userId].activity.length - 1]
            const lastListen =
              !lastActivity || !lastActivity.t
                ? null
                : lastActivity.s + lastActivity.t
            cachedUsers[userId] = {
              ...users[userId],
              lastListen
            }
            for (const track of users[userId].activity) {
              if (/^[a-z0-9]{22}$/i.test(track.id)) {
                if (
                  !trackIds.includes(track.id) &&
                  !(track.id in this.tracks)
                )
                  trackIds.push(track.id)
              } else {
                console.log(
                  'Invalid ID "%s" from user %s',
                  track.id,
                  userId
                )
                console.log(track)
              }
            }
          }
          if (trackIds.length) {
            for (let i = 0; i < trackIds.length; i++) {
              if (i % 50 === 0) trackIdBuckets.unshift([])
              trackIdBuckets[0].push(trackIds[i])
            }
            if (!this.ready) {
              this.loadingData.total = trackIdBuckets.length
              this.loadingData.completed = 0
              this.loadingData.desc = 'Loading Spotify Data'
            }
            this.tracksQueue.push(trackIdBuckets)
            return this.tracksQueue.drain()
          }
        })
        .then(() => {
          this.$store.dispatch('saveTracks', cachedTracks)
          for (const [userId, data] of Object.entries(cachedUsers))
            this.$store.dispatch('updateUser', { userId, data })
          this.userIds = userIds
          this.$store.dispatch('reinitUsers')
          cachedTracks = []
          cachedUsers = {}
        })
        .catch(error => {
          console.error(error)
        })
    },
    // usersHandler(userIds, callback) {
    //   if (userIds.length > 72) {
    //     const extraUserIds = userIds.slice(72)
    //     userIds = userIds.slice(0, 72)
    //     this.tracksQueue.push([extraUserIds])
    //   }
    //   vapi
    //     .getMultiData('/dspotify', userIds)
    //     .then(users => {
    //       if (!this.ready) {
    //         this.loadingData.complete++
    //         console.log(
    //           'Loaded %s users, %s buckets complete',
    //           Object.keys(users).length,
    //           this.loadingData.complete
    //         )
    //       }
    //       Object.assign(cachedUsers, users)
    //     })
    //     .catch(error => {
    //       console.error(error)
    //     })
    // },
    tracksHandler(trackIds, callback) {
      if (trackIds.length > 50) {
        const extraTrackIds = trackIds.slice(50)
        trackIds = trackIds.slice(0, 50)
        this.tracksQueue.push([extraTrackIds])
      }
      spotify
        .getTracks(trackIds)
        .then(({ tracks }) => {
          if (!this.ready) {
            this.loadingData.complete++
            console.log(
              'Loaded %s tracks, %s buckets complete',
              tracks.length,
              this.loadingData.complete
            )
          }
          cachedTracks.push(...tracks)
          callback()
        })
        .catch(error => {
          if (error.response && error.status === 429) {
            const retryTimeout = parseInt(
              error.response.headers['retry-after'],
              10
            )
            console.log(
              'Bucket ratelimited, retrying in %ss',
              retryTimeout
            )
            setTimeout(() => {
              this.tracksHandler(trackIds, callback)
            }, retryTimeout * 1000 + 500)
          } else {
            console.error(error)
          }
        })
    },
    dataInterval() {
      setTimeout(() => {
        this.refreshData().then(() => {
          this.dataInterval()
        })
      }, 1000)
    },
    sortUsers() {
      const { users } = this
      const listening = []
      const notListening = []
      for (const userId of this.userIds) {
        if (!(userId in users)) continue
        if (users[userId].lastListen == null) listening.push(userId)
        else notListening.push(userId)
      }
      listening.sort((a, b) => {
        if (
          users[a].member.username.toLowerCase() >
          users[b].member.username.toLowerCase()
        )
          return 1
        if (
          users[a].member.username.toLowerCase() <
          users[b].member.username.toLowerCase()
        )
          return -1
        return 0
      })
      notListening.sort((a, b) => {
        if (users[a].lastListen > users[b].lastListen) return -1
        if (users[a].lastListen < users[b].lastListen) return 1
        return 0
      })
      this.userIds = listening.concat(notListening)
    }
  },
  created() {
    this.refreshData().then(() => {
      this.ready = true
      this.dataInterval()
    })
    this.$store.subscribe((mutation, payload) => {
      if (mutation.type === 'reinitUsers') this.sortUsers()
    })
  }
}
</script>

<style lang="scss">
.home {
  align-items: center;
  background: #121212;
  display: flex;
  flex-direction: column;
  padding: 48px;
  .feed {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    width: 400px;
  }
  .splash {
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: center;
    .progress-desc {
      color: rgba(#FFF, 0.625);
      margin-bottom: 6px;
    }
    .progress-bar {
      background: rgba(#FFF, 0.25);
      border-radius: 999px;
      display: inline-flex;
      height: 6px;
      justify-content: flex-start;
      overflow: hidden;
      width: 300px;
    }
    .progress {
      background: rgba(#FFF, 0.5);
      height: 100%;
    }
  }
}
</style>
